import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

import '../app/clicks/clicksMethods';
import '../app/clicks/clicksPublishes';
import '../app/cron';

import { runSyncs } from '../app/runSyncs';

const { disableRunSyncsOnStartup = true } = Meteor.settings || {};

Accounts.emailTemplates.siteName =
  Meteor.settings?.public?.appInfo?.name || process.env.ROOT_URL;

Meteor.startup(() => {
  if (disableRunSyncsOnStartup) {
    console.log('runSyncs disabled on startup.');
    return;
  }
  runSyncs().catch((err) => {
    console.error('Error running syncs.', err);
  });
});
