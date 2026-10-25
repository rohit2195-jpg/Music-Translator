// AWS Lambda entry point (handler: lambda.handler). Turns Lambda events into normal requests for the Express app.
import serverless from 'serverless-http';
import app from './server.js';

export const handler = serverless(app);
