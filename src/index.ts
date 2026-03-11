import worker from './http/worker';

export default worker;

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  console.log(`Starting hive-manager-mcp-server on port ${port}...`);
}
