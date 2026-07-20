import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/** Arbitrum One native USDC — never deploy a mock here */
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from ${deployer.address} on ${network.name}`);

  let usdcAddress = process.env.USDC_ADDRESS || '';
  let mockUsdc: Awaited<ReturnType<Awaited<ReturnType<typeof ethers.getContractFactory>>['deploy']>> | null =
    null;

  if (network.name === 'arbitrum') {
    usdcAddress = USDC_ARB;
    console.log(`Using Arbitrum One USDC: ${usdcAddress}`);
  } else if (!usdcAddress || network.name === 'hardhat' || network.name === 'localhost') {
    // Testnets / local: always deploy our own MockUSDC unless USDC_ADDRESS is forced
    const Mock = await ethers.getContractFactory('MockUSDC');
    mockUsdc = await Mock.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    // Mint a large test float to the deployer (funding wallet)
    const mintAmt = ethers.parseUnits(process.env.MOCK_USDC_MINT || '1000000', 6);
    await (await mockUsdc.mint(deployer.address, mintAmt)).wait();
    console.log(`MockUSDC: ${usdcAddress} (minted ${ethers.formatUnits(mintAmt, 6)} to deployer)`);
  } else {
    console.log(`Using USDC_ADDRESS: ${usdcAddress}`);
  }

  const guardian = process.env.RESCUE_GUARDIAN || deployer.address;

  const Pot = await ethers.getContractFactory('PayGramPot');
  const Bill = await ethers.getContractFactory('PayGramBillEscrow');
  const Rosca = await ethers.getContractFactory('PayGramRosca');
  const Tab = await ethers.getContractFactory('PayGramTab');
  const Allowance = await ethers.getContractFactory('PayGramAllowance');

  const pot = await Pot.deploy(usdcAddress, guardian);
  const bill = await Bill.deploy(usdcAddress, guardian);
  const rosca = await Rosca.deploy(usdcAddress, guardian);
  const tab = await Tab.deploy(usdcAddress, guardian);
  const allowance = await Allowance.deploy(usdcAddress, guardian);

  await Promise.all([
    pot.waitForDeployment(),
    bill.waitForDeployment(),
    rosca.waitForDeployment(),
    tab.waitForDeployment(),
    allowance.waitForDeployment(),
  ]);

  const addresses = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    usdc: usdcAddress,
    mockUsdc: Boolean(mockUsdc),
    rescueGuardian: guardian,
    PayGramPot: await pot.getAddress(),
    PayGramBillEscrow: await bill.getAddress(),
    PayGramRosca: await rosca.getAddress(),
    PayGramTab: await tab.getAddress(),
    PayGramAllowance: await allowance.getAddress(),
    deployer: deployer.address,
  };

  console.log(JSON.stringify(addresses, null, 2));

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(out, JSON.stringify(addresses, null, 2));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
