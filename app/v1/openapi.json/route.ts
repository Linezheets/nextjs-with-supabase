import { NextResponse } from 'next/server';

/**
 * GET /v1/openapi.json — public OpenAPI 3.1 description of the /v1 API.
 * No auth (discovery). Kept hand-authored but co-located with the routes so it
 * stays in sync; the integrations docs page should render from this.
 */

export const dynamic = 'force-dynamic';

const listEnvelope = (itemRef: string) => ({
  type: 'object',
  properties: {
    data       : { type: 'array', items: { $ref: itemRef } },
    has_more   : { type: 'boolean' },
    next_cursor: { type: 'string', nullable: true },
    request_id : { type: 'string' },
  },
});

const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Linezheets API',
    version: '1.0.0',
    description: 'Public REST API for authorised Linezheets brand integrations. Authenticate with a brand API key: `Authorization: Bearer lz_live_…`.',
  },
  servers: [{ url: 'https://api.linezheets.com/v1' }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'lz_live_…', description: 'Brand API key.' },
    },
    parameters: {
      limit:  { name: 'limit',  in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
      cursor: { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Opaque pagination cursor from a previous response.' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              type   : { type: 'string', enum: ['invalid_request', 'authentication', 'forbidden', 'not_found', 'rate_limit', 'server'] },
              message: { type: 'string' },
              code   : { type: 'string' },
            },
          },
          request_id: { type: 'string' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' }, sku: { type: 'string', nullable: true }, name: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true }, category: { type: 'string', nullable: true },
          gender: { type: 'string' }, season: { type: 'string', nullable: true }, color: { type: 'string', nullable: true },
          material: { type: 'string', nullable: true }, sizes: { type: 'object', additionalProperties: { type: 'number' }, nullable: true },
          images: { type: 'array', items: { type: 'string' } },
          wholesale_price_usd: { type: 'number', nullable: true }, retail_price_usd: { type: 'number', nullable: true },
          min_order_qty: { type: 'number', nullable: true }, stock: { type: 'number', nullable: true },
          status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }, sku: { type: 'string' }, category: { type: 'string' }, gender: { type: 'string' },
          season: { type: 'string' }, color: { type: 'string' }, material: { type: 'string' },
          sizes: { type: 'object', additionalProperties: { type: 'number' } }, images: { type: 'array', items: { type: 'string' } },
          wholesale_price_usd: { type: 'number' }, retail_price_usd: { type: 'number' }, min_order_qty: { type: 'number' },
          stock: { type: 'number' }, description: { type: 'string' }, status: { type: 'string' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' }, status: { type: 'string' }, total_usd: { type: 'number' }, currency: { type: 'string', nullable: true },
          brand_name: { type: 'string', nullable: true }, buyer_name: { type: 'string', nullable: true },
          items: { type: 'array', items: { type: 'object' } }, terms: { type: 'string', nullable: true }, notes: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Buyer: {
        type: 'object',
        properties: {
          id: { type: 'string' }, store_name: { type: 'string' }, first_name: { type: 'string', nullable: true }, last_name: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true }, country: { type: 'string' }, market_segment: { type: 'string', nullable: true },
          categories_sold: { type: 'array', items: { type: 'string' } }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      Linesheet: {
        type: 'object',
        properties: {
          id: { type: 'string' }, filename: { type: 'string', nullable: true }, status: { type: 'string' },
          rows_parsed: { type: 'number', nullable: true }, rows_created: { type: 'number', nullable: true }, rows_skipped: { type: 'number', nullable: true },
          errors: {}, created_at: { type: 'string', format: 'date-time' }, completed_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  paths: {
    '/products': {
      get: {
        summary: 'List products', tags: ['Products'],
        parameters: [{ $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/cursor' }],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: listEnvelope('#/components/schemas/Product') } } } },
      },
      post: {
        summary: 'Create a product', tags: ['Products'],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Product' }, request_id: { type: 'string' } } } } } } },
      },
    },
    '/products/{id}': {
      get: { summary: 'Get a product', tags: ['Products'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
      patch: {
        summary: 'Update a product', tags: ['Products'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
    },
    '/orders': {
      get: { summary: 'List orders', tags: ['Orders'], parameters: [{ $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/cursor' }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: listEnvelope('#/components/schemas/Order') } } } } },
    },
    '/orders/{id}': {
      get: { summary: 'Get an order', tags: ['Orders'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
    },
    '/buyers': {
      get: { summary: 'List buyers who ordered from you', tags: ['Buyers'], parameters: [{ $ref: '#/components/parameters/limit' }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: listEnvelope('#/components/schemas/Buyer') } } } } },
    },
    '/linesheets': {
      get: { summary: 'List linesheet import jobs', tags: ['Linesheets'], parameters: [{ $ref: '#/components/parameters/limit' }, { $ref: '#/components/parameters/cursor' }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: listEnvelope('#/components/schemas/Linesheet') } } } } },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(SPEC, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
