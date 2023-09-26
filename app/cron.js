import { SyncedCron } from 'meteor/littledata:synced-cron';
import { Meteor } from 'meteor/meteor';
import { runSyncs } from './runSyncs';

const {
  dataSyncCronHistoryCollectionName = 'dataSyncCronHistory',
  cronLogs = true,
  runSyncParserText = 'every 45 mins',
  disableCronRunSyncs,
} = Meteor.settings || {};

SyncedCron.config({
  log: cronLogs,
  collectionName: dataSyncCronHistoryCollectionName,
  utc: false,
});

Meteor.startup(() => {
  if (!disableCronRunSyncs) {
    console.log('runSyncs cron enabled.');
    SyncedCron.add({
      name: 'Run syncs',
      schedule: (parser) => parser.text(runSyncParserText),
      job: () =>
        runSyncs().catch((err) => {
          console.error('Error running cron syncs.', err);
        }),
    });
  }

  SyncedCron.start();
});
