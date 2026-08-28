import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trafikverket API',
      version: '1.0.0',
      description: 'API for Swedish train information including stations, train positions, announcements, and disruptions',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://trafikverket-api-production.up.railway.app',
        description: 'Production (Railway)',
      },
    ],
    components: {
      parameters: {
        AdvertisedTimeFrom: {
          in: 'query',
          name: 'from',
          required: false,
          schema: {
            type: 'string',
            format: 'date-time',
            example: '2026-08-28T00:00:00+02:00',
          },
          description:
            'Lower bound on AdvertisedTimeAtLocation (`GT`). ISO-8601 date-time. Omit for no lower bound.',
        },
        AdvertisedTimeTo: {
          in: 'query',
          name: 'to',
          required: false,
          schema: {
            type: 'string',
            format: 'date-time',
            example: '2026-08-28T23:59:59+02:00',
          },
          description:
            'Upper bound on AdvertisedTimeAtLocation (`LT`). ISO-8601 date-time. Omit for no upper bound. Neither `from` nor `to` means no advertised-time filter.',
        },
      },
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
        OperationalTransportIdentifier: {
          type: 'object',
          properties: {
            objectType: {
              type: 'string',
            },
            company: {
              type: 'string',
            },
            core: {
              type: 'string',
            },
            variant: {
              type: 'string',
            },
            timetableYear: {
              type: 'number',
            },
            startDate: {
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
            estimatedTimeIsPreliminary: {
              type: 'boolean',
              description: 'Whether the estimated time is preliminary',
            },
            advertisedTrainIdent: {
              type: 'string',
              description: 'Train identifier',
            },
            advertisedTrainReference: {
              type: 'string',
              description: 'Advertised train reference',
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
            operationalTransportIdentifiers: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OperationalTransportIdentifier',
              },
              description: 'TAF/TAP operational transport identifiers',
            },
            plannedEstimatedTimeAtLocation: {
              type: 'string',
              description: 'Planned estimated time at location',
            },
            plannedEstimatedTimeAtLocationIsValid: {
              type: 'boolean',
              description: 'Whether the planned estimated time is valid',
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
