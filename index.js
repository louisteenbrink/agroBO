require('dotenv').config();
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const dialectOptions = {};

const { randomUUID } = require('crypto');

if (process.env.DATABASE_SSL && JSON.parse(process.env.DATABASE_SSL.toLowerCase())) {
  // Set to false to bypass SSL certificate verification (useful for self-signed certificates).
  const rejectUnauthorized =
    process.env.DATABASE_REJECT_UNAUTHORIZED &&
    JSON.parse(process.env.DATABASE_REJECT_UNAUTHORIZED.toLowerCase());
  dialectOptions.ssl = !rejectUnauthorized
    ? {
        require: true,
        rejectUnauthorized,
      }
    : true;
}

// Create the Forest Admin agent.
/**
 * @type {import('@forestadmin/agent').Agent<import('./typings').Schema>}
 */
const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
  // Autocompletion of collection names and fields
  typingsPath: './typings.ts',
  typingsMaxDepth: 5,
})
  // Connect your datasources.
  .addDataSource(
    createSqlDataSource({
      uri: process.env.DATABASE_URL,
      schema: process.env.DATABASE_SCHEMA,
      dialectOptions,
    }),
  );

// Add customizations here.
// agent.customizeCollection('collectionName', collection => ...);
    agent.customizeCollection('Coupon', c =>
      c.replaceFieldWriting('id', null).addHook('Before', 'Create', ctx => {
        ctx.data.forEach(record => {
          record.id = randomUUID();
        });
      }),
    )
    .customizeCollection('Address', collection => {
        collection
          // Create a first field which is computed by concatenating the first and last names
          .addField('full address', {
            columnType: 'String',
            dependencies: ['address', 'city', 'country', 'zipCode'],
            getValues: (records, context) => records.map(r => `${r.address}, ${r.city}, ${r.country}, ${r.zipCode}`),
          })

          // Create a second field which is computed by uppercasing the first field
          .addField('latLong', {
            columnType: 'String',
            dependencies: ['latitude', 'longitude'], // It is legal to depend on another computed field
            getValues: (records, context) => records.map(r => `${r.latitude}, ${r.longitude}`)
          });
      })
    .customizeCollection('User', collection =>
      collection.addAction('Make a phone call', {
        scope: 'Single',
        form: [{
          label: 'phone number',
          type: 'String',
          defaultValue: async context => {
          return (await context.getRecord(['phone']))?.phone;
        },
        }],
        execute: async context => {
          // Perform work here.
        },
      }),
    );


agent
  // Expose an HTTP endpoint.
  .mountOnStandaloneServer(process.env.PORT || process.env.APPLICATION_PORT)
  // Start the agent.
  .start();



