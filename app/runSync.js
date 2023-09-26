import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';
import { BigQuery } from '@google-cloud/bigquery';
import { createOrGetCollection } from './mongo';

const {
  debug,
  dataSyncsCollectionName = 'dataSyncs',
  mongoOplogReadBatchSize = 100,
  mongoDatabase,
  bigQueryAccountsServiceFileName,
  bigQueryProjectId,
  bigQueryDatabase,
} = Meteor.settings || {};

const options = {
  // eslint-disable-next-line no-undef
  keyFilename: Assets.absoluteFilePath(bigQueryAccountsServiceFileName),
  projectId: bigQueryProjectId,
};

const bigquery = new BigQuery(options);

export const insertRows = async ({ table, rows }) => {
  try {
    await bigquery.dataset(bigQueryDatabase).table(table).insert(rows);
  } catch (e) {
    console.error('Error inserting rows to bigquery.', e);
    if (e.errors) {
      console.error(
        'Error inserting rows to bigquery.',
        JSON.stringify(e.errors, null, 2)
      );
    }
    throw e;
  }
};

const DataSyncsCollection = createOrGetCollection({
  name: dataSyncsCollectionName,
});

const getDataSync = async ({ collectionName }) => {
  const dataSync = await DataSyncsCollection.findOneAsync({ collectionName });

  if (dataSync) {
    return dataSync;
  }
  return DataSyncsCollection.findOneAsync(
    await DataSyncsCollection.insertAsync({
      collectionName,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );
};
const setDataSync = async ({ _id, ...rest }) => {
  await DataSyncsCollection.updateAsync(
    { _id },
    { $set: { ...rest, updatedAt: new Date() } }
  );
};
export const runSync = async ({ name: collectionName, projection = {} }) => {
  if (!process.env.MONGO_URL) {
    console.error('runSync error: missing MONGO_URL.');
    return;
  }
  if (!process.env.MONGO_OPLOG_URL) {
    console.error('runSync error: missing MONGO_OPLOG_URL.');
    return;
  }
  if (
    !mongoDatabase ||
    !bigQueryAccountsServiceFileName ||
    !bigQueryProjectId ||
    !bigQueryDatabase
  ) {
    console.error(
      'runSync error: missing settings. All these fields are required: mongoDatabase, bigQueryAccountsServiceFileName, bigQueryProjectId, and bigQueryDatabase.'
    );
    return;
  }
  if (!collectionName) {
    console.error('runSync error: collectionName is required.');
    return;
  }
  console.log('runSync');

  const dataSync = await getDataSync({ collectionName });
  const { lastSyncedDocumentWall, lastSyncedDocumentTs } = dataSync;
  const collection = createOrGetCollection({ name: collectionName });

  const oplogDb =
    MongoInternals.defaultRemoteCollectionDriver().mongo._oplogHandle
      ._oplogTailConnection.db;

  const oplogCollection = oplogDb.collection('oplog.rs');

  const query = {
    ...(lastSyncedDocumentWall && { wall: { $gte: lastSyncedDocumentWall } }),
    // as we are using equal we should ignore the last one synced last time to not duplicate
    ...(lastSyncedDocumentTs && { ts: { $ne: lastSyncedDocumentTs } }),
    op: { $in: ['u', 'i'] },
    ns: `${mongoDatabase}.${collectionName}`,
  };

  const findOptions = {
    limit: mongoOplogReadBatchSize,
    sort: { wall: 1 },
    projection: { ts: 1, 'o2._id': 1, wall: 1 },
  };

  const startOplogFind = new Date();
  const prefix = `runSync:${collectionName}:`;
  console.log(
    `${prefix}oplog find\n${JSON.stringify(query, null, 2)}\n${JSON.stringify(
      findOptions,
      null,
      2
    )}`
  );

  const cursor = oplogCollection.find(query, findOptions);
  const data = await cursor.toArray();
  const tsOplogMessage = `(${(
    new Date().getTime() - startOplogFind.getTime()
  ).toLocaleString()}ms):`;
  if (!data.length) {
    console.log(`${prefix}${tsOplogMessage}oplog no data`);
    return;
  }
  console.log(`${prefix}${tsOplogMessage}oplog data (${data.length})`);
  if (debug) {
    console.log(`${JSON.stringify(data, null, 2)}`);
  }
  const ids = data.map(({ o2 }) => o2._id);
  const rows = collection.find({ _id: { $in: ids } }, { projection }).fetch();
  await insertRows({
    table: collectionName,
    rows,
  });
  const lastDatum = data[rows.length - 1];

  const newDataSync = {
    ...dataSync,
    lastSyncedDocumentTs: lastDatum.ts,
    lastSyncedDocumentWall: lastDatum.wall,
  };
  console.log(`${prefix}setDataSync\n${JSON.stringify(newDataSync, null, 2)}`);
  await setDataSync(newDataSync);
};
