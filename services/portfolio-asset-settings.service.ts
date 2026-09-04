import { prisma } from "@/lib/prisma";

export async function getStablecoinSymbols(accountId: string) {
  const rows = await prisma.portfolio_asset_setting.findMany({
    where: { account_id: accountId, is_stablecoin: true },
    select: { asset_symbol: true },
  });

  return new Set(
    rows.map((row) => row.asset_symbol.trim().toUpperCase()).filter(Boolean),
  );
}

export async function getPortfolioAssetSettings(accountId: string) {
  const rows = await prisma.portfolio_asset_setting.findMany({
    where: { account_id: accountId },
    select: { asset_symbol: true, is_stablecoin: true, is_hidden: true },
  });

  return {
    stablecoinSymbols: new Set(
      rows
        .filter((row) => row.is_stablecoin)
        .map((row) => row.asset_symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
    hiddenSymbols: new Set(
      rows
        .filter((row) => row.is_hidden)
        .map((row) => row.asset_symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  };
}

export async function setPortfolioAssetStablecoin(params: {
  accountId: string;
  symbol: string;
  isStablecoin: boolean;
}) {
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol || symbol === "CASH") return;

  await prisma.portfolio_asset_setting.upsert({
    where: {
      account_id_asset_symbol: {
        account_id: params.accountId,
        asset_symbol: symbol,
      },
    },
    update: { is_stablecoin: params.isStablecoin },
    create: {
      account_id: params.accountId,
      asset_symbol: symbol,
      is_stablecoin: params.isStablecoin,
    },
    select: { id: true },
  });
}

export async function setPortfolioAssetHidden(params: {
  accountId: string;
  symbol: string;
  isHidden: boolean;
}) {
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol || symbol === "CASH") return;

  await prisma.portfolio_asset_setting.upsert({
    where: {
      account_id_asset_symbol: {
        account_id: params.accountId,
        asset_symbol: symbol,
      },
    },
    update: { is_hidden: params.isHidden },
    create: {
      account_id: params.accountId,
      asset_symbol: symbol,
      is_hidden: params.isHidden,
    },
    select: { id: true },
  });
}
