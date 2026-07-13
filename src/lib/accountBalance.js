import { parseWartBalanceFromApi } from '../components/explorer/explorerAddressUtils.js';

/** Fetch WART balance, trying legacy and modern node endpoints. */
export async function fetchAccountWartBalance(api, address) {
  let result = await api.getAccountBalance(address);
  if (!result.success) {
    result = await api.getAccountWartBalance(address);
  }
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch balance');
  }
  return parseWartBalanceFromApi(result.data) ?? '0';
}