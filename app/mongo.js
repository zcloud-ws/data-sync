import { Meteor } from 'meteor/meteor';
import { createCollection } from 'meteor/quave:collections';

const collections = {};

export const createOrGetCollection = (arg) => {
  const { name } = arg;
  if (!collections[name]) {
    collections[name] = createCollection(
      name === 'users' ? { ...arg, instance: Meteor.users } : arg
    );
  }

  return collections[name];
};
