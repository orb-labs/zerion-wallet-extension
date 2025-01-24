let ACCOUNT_CLUSTER = null;

export async function getOrCreateAccountCluster(baseMainnetClient, accounts) {
  if (!ACCOUNT_CLUSTER) {
    ACCOUNT_CLUSTER = await baseMainnetClient.createAccountCluster(accounts);
  }
  console.log('ACCOUNT_CLUSTER', ACCOUNT_CLUSTER);
  return ACCOUNT_CLUSTER;
}
