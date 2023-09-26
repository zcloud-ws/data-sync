import { runSync } from './runSync';
import { Meteor } from 'meteor/meteor';

const { mongoCollections = [] } = Meteor.settings || {};
export const runSyncs = async () => {
  if (!mongoCollections || !mongoCollections.length) {
    console.error('runSyncs error: missing mongoCollections in settings.');
    return;
  }
  for await (const collectionData of mongoCollections) {
    const start = new Date();
    try {
      console.log(`Starting run sync for collection ${collectionData.name}`);
      await runSync(collectionData);
      console.log(
        `Finished run sync for collection ${collectionData.name} (${(
          new Date().getTime() - start.getTime()
        ).toLocaleString()}ms)`
      );
    } catch (e) {
      console.error(
        `Error run sync for collection ${collectionData.name} (${(
          new Date().getTime() - start.getTime()
        ).toLocaleString()}ms)`,
        e
      );
    }
  }
};
