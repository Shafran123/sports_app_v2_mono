import { execSync } from 'node:child_process';

export default async function teardown(project) {
  const dbName = project.getProvidedContext().dbName;
  const adminUrl = project.getProvidedContext().adminUrl;
  try {
    execSync(`dropdb --if-exists -h localhost "${dbName}"`, { stdio: 'ignore' });
  } catch (err) {
    console.warn(`Failed to drop test database ${dbName}: ${err.message}`);
  }
}
