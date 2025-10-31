import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trafikverket API',
      version: '1.0.0',
      description: 'API for Swedish train information including stations, train positions, and announcements',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        LocationInfo: {
          type: 'object',
          properties: {
            locationName: {
              type: 'string',
            },
            priority: {
              type: 'number',
            },
            order: {
              type: 'number',
            },
          },
        },
        InformationItem: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
          },
        },
        Deviation: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
          },
        },
        Announcement: {
          type: 'object',
          properties: {
            activityId: {
              type: 'string',
            },
            locationSignature: {
              type: 'string',
              description: 'Station code/signature',
            },
            advertisedTimeAtLocation: {
              type: 'string',
              description: 'Scheduled time at location',
            },
            estimatedTimeAtLocation: {
              type: 'string',
              description: 'Estimated time at location',
            },
            advertisedTrainIdent: {
              type: 'string',
              description: 'Train identifier',
            },
            toLocation: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/LocationInfo',
              },
              description: 'Destination locations',
            },
            viaToLocation: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/LocationInfo',
              },
              description: 'Via locations',
            },
            trackAtLocation: {
              type: 'string',
              description: 'Track/platform number',
            },
            canceled: {
              type: 'boolean',
              description: 'Whether the train is canceled',
            },
            operator: {
              type: 'string',
              description: 'Train operator',
            },
            otherInformation: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/InformationItem',
              },
              description: 'Additional information',
            },
            productInformation: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/InformationItem',
              },
              description: 'Product information',
            },
            modifiedTime: {
              type: 'string',
              description: 'Last modified timestamp',
            },
            deviation: {
              $ref: '#/components/schemas/Deviation',
              description: 'Deviation information',
            },
            fromName: {
              type: 'string',
              description: 'Departure station name',
            },
            toName: {
              type: 'string',
              description: 'Destination station name',
            },
          },
        },
      },
    },
  },
  apis: ['./src/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
