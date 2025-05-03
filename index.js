import "dotenv/config";
import blessed from "blessed";
import figlet from "figlet";
import { ethers } from "ethers";
import axios from "axios";

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WETH_ADDRESS = process.env.WETH_ADDRESS;
const USDC_ADDRESS = process.env.USDC_ADDRESS;
const UNI_ADDRESS = process.env.UNI_ADDRESS;
const CRV_ADDRESS = process.env.CRV_ADDRESS;
const DEFI_ADDRESS = process.env.DEFI_ADDRESS;
const SUSHI_ADDRESS = process.env.SUSHI_ADDRESS;
const FAUCET_ADDRESS = process.env.FAUCET_ADDRESS;
const SWAP_CONTRACT_ADDRESS = process.env.SWAP_CONTRACT_ADDRESS;
const LIQUIDITY_CONTRACT_ADDRESS = process.env.LIQUIDITY_CONTRACT_ADDRESS;
const NETWORK_NAME = "HeraFI TESTNET";
const DEBUG_MODE = false;

const SWAP_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "tokenIn", "type": "address"},
      {"name": "amountIn", "type": "uint256"},
      {"name": "data", "type": "bytes"}
    ],
    "name": "swap",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "amountIn", "type": "uint256"},
      {"name": "tokenOut", "type": "address"},
      {"name": "amountOutMin", "type": "uint256"}
    ],
    "name": "swap",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const ERC20ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const FAUCET_ABI = [
  "function tokenLimits(address) view returns (uint256)",
  "function owner_2(address user, address token) view returns (uint256)",
  "function requestToken(address token, uint256 amount) external"
];

const ADD_LIQUIDITY_ABI = [
  "function provideLiquidity(address token, uint256 amount) external returns (uint256)"
];

async function reportTransaction(tx, direction, tokenIn, tokenOut, amountIn, amountOut, receipt) {
  const userAddress = globalWallet.address;
  const tokenAddress = SWAP_CONTRACT_ADDRESS;
  const transactionType = direction.includes("_TO_DEFI") ? "buy" : "sell";
  
  let transactionHash = receipt.transactionHash;
  if (!transactionHash && tx.hash) {
    transactionHash = tx.hash;
  }
  if (!transactionHash) {
    addLog(`Failed to Obtain Tx Hash, Tx Report Skipped.`, "error");
    return;
  }

  const chainId = 11155420;

  let gasPrice;
  if (receipt.effectiveGasPrice) {
    gasPrice = receipt.effectiveGasPrice;
  } else if (tx.gasPrice) {
    gasPrice = tx.gasPrice;
  } else if (tx.maxFeePerGas) {
    gasPrice = tx.maxFeePerGas;
  } else {
    try {
      gasPrice = await provider.getFeeData().gasPrice;
    } catch (error) {
      addLog(`Failed to obtain gasPrice: ${error.message}. Using default value 1 gwei.`, "warning");
      gasPrice = ethers.parseUnits("1", "gwei");
    }
  }

  let gasUsed;
  try {
    gasUsed = Number(receipt.gasUsed);
    if (isNaN(gasUsed)) throw new Error("gasUsed is not a valid number");
  } catch (error) {
    addLog(`Failed to convert gasUsed: ${error.message}. Using default value 0.`, "warning");
    gasUsed = 0;
  }

  const transactionFee = parseFloat(ethers.formatUnits(gasPrice * BigInt(gasUsed), "ether"));
  const blockNumber = receipt.blockNumber;
  const block = await provider.getBlock(receipt.blockNumber);
  const blockTimestamp = new Date(block.timestamp * 1000).toISOString();

  const priceAtTransaction = parseFloat(amountOut) / parseFloat(amountIn);
  const marketPriceAtTransaction = priceAtTransaction;

  const positionSizeUsd = transactionType === "buy" ? (parseFloat(amountOut) * priceAtTransaction) : (parseFloat(amountIn) * priceAtTransaction);
  const realizedPnl = 0;
  const cumulativeCostBasis = 0;
  const averageEntryPrice = 0;
  const remainingTokens = 0;
  const slippage = 0;

  const payload = {
    user_address: userAddress,
    token_address: tokenAddress,
    amount: transactionType === "buy" ? parseFloat(amountOut) : parseFloat(amountIn),
    price_at_transaction: priceAtTransaction,
    transaction_type: transactionType,
    transaction_hash: transactionHash,
    chain_id: chainId,
    gas_price: parseFloat(ethers.formatUnits(gasPrice, "gwei")),
    gas_used: gasUsed,
    transaction_fee: transactionFee,
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    market_price_at_transaction: marketPriceAtTransaction,
    position_size_usd: positionSizeUsd,
    realized_pnl: realizedPnl,
    cumulative_cost_basis: cumulativeCostBasis,
    average_entry_price: averageEntryPrice,
    remaining_tokens: remainingTokens,
    slippage: slippage
  };

  const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnaWZ3aGt1YWh0aXR3dmNsYW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyOTU0NTUsImV4cCI6MjA1Njg3MTQ1NX0.rPH6IVNsblq_rIwnAE8dNdKPtBtuY7MkKMi67Ut8KVA";
  const authorization = `Bearer ${apiKey}`;

  try {
    const response = await axios.post("https://hgifwhkuahtitwvclank.supabase.co/rest/v1/positions?select=*", payload, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
        "Authorization": authorization
      }
    });
    addLog(`Transaction Report Successfully Sent`, "success");
  } catch (error) {
    let errorMessage = error.message;
    if (error.response) {
      errorMessage += ` | Status: ${error.response.status} | Data: ${JSON.stringify(error.response.data)}`;
    }
    addLog(`Failed to Send Transaction Report: ${errorMessage}`, "error");
  }
}

let walletInfo = {
  address: "",
  balanceNative: "0.00",
  balanceWeth: "0.00",
  balanceUsdc: "0.00",
  balanceUni: "0.00",
  balanceCrv: "0.00",
  balanceDefi: "0.00",
  balanceSushi: "0.00",
  network: NETWORK_NAME,
  status: "Initializing"
};

let transactionLogs = [];
let heraFISwapRunning = false;
let heraFISwapCancelled = false;
let autoClaimRunning = false;
let autoClaimCancelled = false;
let globalWallet = null;
let provider = null;
let transactionQueue = Promise.resolve();
let transactionQueueList = [];
let transactionIdCounter = 0;
let nextNonce = null;
let lastSwapDirection = null;
let lastSwapDirectionSushi = null;
let lastSwapDirectionCrv = null;
let lastSwapDirectionUni = null;
let lastSwapDirectionUsdc = null;
let liquidityContract;

function getShortAddress(address) {
  return address ? address.slice(0, 6) + "..." + address.slice(-4) : "N/A";
}

function getShortHash(hash) {
  if (!hash || typeof hash !== "string" || hash === "0x") {
    return "Invalid Hash";
  }
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}

function addLog(message, type) {
  if (type === "debug" && !DEBUG_MODE) {
    return;
  }
  const timestamp = new Date().toLocaleTimeString();
  let coloredMessage = message;
  if (type === "herafi") coloredMessage = `{bright-cyan-fg}${message}{/bright-cyan-fg}`;
  else if (type === "faucet") coloredMessage = `{bright-blue-fg}${message}{/bright-blue-fg}`;
  else if (type === "system") coloredMessage = `{bright-white-fg}${message}{/bright-white-fg}`;
  else if (type === "error") coloredMessage = `{bright-red-fg}${message}{/bright-red-fg}`;
  else if (type === "success") coloredMessage = `{bright-green-fg}${message}{/bright-green-fg}`;
  else if (type === "warning") coloredMessage = `{bright-yellow-fg}${message}{/bright-yellow-fg}`;
  else if (type === "debug") coloredMessage = `{bright-magenta-fg}${message}{/bright-magenta-fg}`;

  transactionLogs.push(`{bright-cyan-fg}[{/bright-cyan-fg} {bold}{grey-fg}${timestamp}{/grey-fg}{/bold} {bright-cyan-fg}]{/bright-cyan-fg} {bold}${coloredMessage}{/bold}`);
  updateLogs();
}

function getRandomDelay() {
  return Math.random() * (60000 - 30000) + 30000;
}

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function updateLogs() {
  logsBox.setContent(transactionLogs.join("\n"));
  logsBox.setScrollPerc(100);
  safeRender();
}

function clearTransactionLogs() {
  transactionLogs = [];
  logsBox.setContent("");
  logsBox.setScroll(0);
  updateLogs();
  safeRender();
  addLog("Transaction logs have been cleared.", "system");
}

async function waitWithCancel(delay, type) {
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, delay)),
    new Promise(resolve => {
      const interval = setInterval(() => {
        if ((type === "swap" && heraFISwapCancelled) || (type === "faucet" && autoClaimCancelled)) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    })
  ]);
}

async function addTransactionToQueue(transactionFunction, description = "Transaction") {
  const transactionId = ++transactionIdCounter;
  transactionQueueList.push({
    id: transactionId,
    description,
    timestamp: new Date().toLocaleTimeString(),
    status: "queued"
  });
  addLog(`Transaction [${transactionId}] added to queue: ${description}`, "system");
  updateQueueDisplay();

  transactionQueue = transactionQueue.then(async () => {
    updateTransactionStatus(transactionId, "processing");
    try {
      if (nextNonce === null) {
        nextNonce = await provider.getTransactionCount(globalWallet.address, "pending");
        addLog(`Initial nonce: ${nextNonce}`, "debug");
      }
      const tx = await transactionFunction(nextNonce);
      const txHash = tx.hash;
      const receipt = await tx.wait();
      nextNonce++;
      if (receipt.status === 1) {
        updateTransactionStatus(transactionId, "completed");
        addLog(`Transaction [${transactionId}] Completed. Hash: ${getShortHash(receipt.transactionHash || txHash)}`, "success");
      } else {
        updateTransactionStatus(transactionId, "failed");
        addLog(`Transaction [${transactionId}] failed: Transaction rejected by contract.`, "error");
      }
      return { receipt, txHash, tx };
    } catch (error) {
      updateTransactionStatus(transactionId, "error");
      let errorMessage = error.message;
      if (error.code === "CALL_EXCEPTION") {
        errorMessage = `Transaction rejected by contract: ${error.reason || "Reason unknown"}`;
      }
      addLog(`Transaction [${transactionId}] failed: ${errorMessage}`, "error");
      if (error.message.includes("nonce has already been used")) {
        nextNonce++;
        addLog(`Nonce incremented as it was already used. New nonce value: ${nextNonce}`, "debug");
      }
      return null;
    } finally {
      removeTransactionFromQueue(transactionId);
      updateQueueDisplay();
    }
  });
  return transactionQueue;
}

function updateTransactionStatus(id, status) {
  transactionQueueList.forEach(tx => {
    if (tx.id === id) tx.status = status;
  });
  updateQueueDisplay();
}

function removeTransactionFromQueue(id) {
  transactionQueueList = transactionQueueList.filter(tx => tx.id !== id);
  updateQueueDisplay();
}

function getTransactionQueueContent() {
  if (transactionQueueList.length === 0) return "No transactions in queue.";
  return transactionQueueList
    .map(tx => `ID: ${tx.id} | ${tx.description} | ${tx.status} | ${tx.timestamp}`)
    .join("\n");
}

let queueMenuBox = null;
let queueUpdateInterval = null;

function showTransactionQueueMenu() {
  const container = blessed.box({
    label: " Transaction Queue ",
    top: "10%",
    left: "center",
    width: "80%",
    height: "80%",
    border: { type: "line" },
    style: { border: { fg: "blue" } },
    keys: true,
    mouse: true,
    interactive: true
  });
  const contentBox = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: "90%",
    content: getTransactionQueueContent(),
    scrollable: true,
    keys: true,
    mouse: true,
    alwaysScroll: true,
    scrollbar: { ch: " ", inverse: true, style: { bg: "blue" } }
  });
  const exitButton = blessed.button({
    content: " [Exit] ",
    bottom: 0,
    left: "center",
    shrink: true,
    padding: { left: 1, right: 1 },
    style: { fg: "white", bg: "red", hover: { bg: "blue" } },
    mouse: true,
    keys: true,
    interactive: true
  });
  exitButton.on("press", () => {
    addLog("Exiting Transaction Queue Menu.", "system");
    clearInterval(queueUpdateInterval);
    container.destroy();
    queueMenuBox = null;
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  });
  container.key(["a", "s", "d"], () => {
    addLog("Exiting Transaction Queue Menu.", "system");
    clearInterval(queueUpdateInterval);
    container.destroy();
    queueMenuBox = null;
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  });
  container.append(contentBox);
  container.append(exitButton);
  queueUpdateInterval = setInterval(() => {
    contentBox.setContent(getTransactionQueueContent());
    screen.render();
  }, 1000);
  mainMenu.hide();
  screen.append(container);
  container.focus();
  screen.render();
}

function updateQueueDisplay() {
  if (queueMenuBox) {
    queueMenuBox.setContent(getTransactionQueueContent());
    screen.render();
  }
}

const screen = blessed.screen({
  smartCSR: true,
  title: "HeraFI Swap",
  fullUnicode: true,
  mouse: true
});

let renderTimeout;

function safeRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => { screen.render(); }, 50);
}

const headerBox = blessed.box({
  top: 0,
  left: "center",
  width: "100%",
  tags: true,
  style: { fg: "white", bg: "default" }
});

figlet.text("ADB NODE".toUpperCase(), { font: "ANSI Shadow", horizontalLayout: "default" }, (err, data) => {
  if (err) headerBox.setContent("{center}{bold}ADB NODE{/bold}{/center}");
  else headerBox.setContent(`{center}{bold}{bright-cyan-fg}${data}{/bright-cyan-fg}{/bold}{/center}`);
  safeRender();
});

const descriptionBox = blessed.box({
  left: "center",
  width: "100%",
  content: "{center}{bold}{bright-yellow-fg}✦ ✦ HERAFI AUTO BOT ✦ ✦{/bright-yellow-fg}{/bold}{/center}",
  tags: true,
  style: { fg: "white", bg: "default" }
});

const logsBox = blessed.box({
  label: " Transaction Logs ",
  left: 0,
  border: { type: "line" },
  scrollable: true,
  alwaysScroll: true,
  mouse: true,
  keys: true,
  vi: true,
  tags: true,
  style: { border: { fg: "red" }, fg: "white" },
  scrollbar: { ch: " ", inverse: true, style: { bg: "blue" } },
  content: ""
});

const walletBox = blessed.box({
  label: " Wallet Information ",
  border: { type: "line" },
  tags: true,
  style: { border: { fg: "magenta" }, fg: "white", bg: "default", align: "left", valign: "top" },
  content: "Loading wallet data..."
});

const mainMenu = blessed.list({
  label: " Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "red" }, selected: { bg: "green", fg: "black" } },
  items: getMainMenuItems()
});

function getHeraFISwapMenuItems() {
  let items = [];
  if (heraFISwapRunning) items.push("Stop Transaction");
  items = items.concat([
    "Auto Swap WETH & DEFI",
    "Auto Swap SUSHI & DEFI",
    "Auto Swap CRV & DEFI",
    "Auto Swap UNI & DEFI",
    "Auto Swap USDC & DEFI",
    "Clear Transaction Logs",
    "Back To Main Menu",
    "Refresh"
  ]);
  return items;
}

const heraFISwapSubMenu = blessed.list({
  label: " HeraFI Swap Sub Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "red" }, selected: { bg: "cyan", fg: "black" } },
  items: getHeraFISwapMenuItems()
});
heraFISwapSubMenu.hide();

function getAutoClaimMenuItems() {
  let items = [];
  if (autoClaimRunning) items.push("Stop Transaction");
  items = items.concat([
    "Claim Faucet All Token",
    "Clear Transaction Logs",
    "Back To Main Menu",
    "Refresh"
  ]);
  return items;
}

const autoClaimSubMenu = blessed.list({
  label: " Auto Claim Faucet Sub Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "red" }, selected: { bg: "cyan", fg: "black" } },
  items: getAutoClaimMenuItems()
});
autoClaimSubMenu.hide();

function getAddLiquidityMenuItems() {
  let items = [];
  items = items.concat([
    "Auto Add Liquidity Token",
    "Clear Transaction Logs",
    "Back To Main Menu",
    "Refresh"
  ]);
  return items;
}

const addLiquiditySubMenu = blessed.list({
  label: " Add Liquidity Sub Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "red" }, selected: { bg: "cyan", fg: "black" } },
  items: getAddLiquidityMenuItems()
});
addLiquiditySubMenu.hide();

const promptBox = blessed.prompt({
  parent: screen,
  border: "line",
  height: 5,
  width: "60%",
  top: "center",
  left: "center",
  label: "{bright-blue-fg}Prompt{/bright-blue-fg}",
  tags: true,
  keys: true,
  vi: true,
  mouse: true,
  style: { fg: "bright-red", bg: "default", border: { fg: "red" } }
});

screen.append(headerBox);
screen.append(descriptionBox);
screen.append(logsBox);
screen.append(walletBox);
screen.append(mainMenu);
screen.append(heraFISwapSubMenu);
screen.append(autoClaimSubMenu);
screen.append(addLiquiditySubMenu);

function adjustLayout() {
  const screenHeight = screen.height;
  const screenWidth = screen.width;
  const headerHeight = Math.max(8, Math.floor(screenHeight * 0.15));
  headerBox.top = 0;
  headerBox.height = headerHeight;
  headerBox.width = "100%";
  description箱.top = "20%";
  descriptionBox.height = Math.floor(screenHeight * 0.05);
  logsBox.top = headerHeight + descriptionBox.height;
  logsBox.left = 0;
  logsBox.width = Math.floor(screenWidth * 0.6);
  logsBox.height = screenHeight - (headerHeight + descriptionBox.height);
  walletBox.top = headerHeight + descriptionBox.height;
  walletBox.left = Math.floor(screenWidth * 0.6);
  walletBox.width = Math.floor(screenWidth * 0.4);
  walletBox.height = Math.floor(screenHeight * 0.35);
  mainMenu.top = headerHeight + descriptionBox.height + walletBox.height;
  mainMenu.left = Math.floor(screenWidth * 0.6);
  mainMenu.width = Math.floor(screenWidth * 0.4);
  mainMenu.height = screenHeight - (headerHeight + descriptionBox.height + walletBox.height);
  heraFISwapSubMenu.top = mainMenu.top;
  heraFISwapSubMenu.left = mainMenu.left;
  heraFISwapSubMenu.width = mainMenu.width;
  heraFISwapSubMenu.height = mainMenu.height;
  autoClaimSubMenu.top = mainMenu.top;
  autoClaimSubMenu.left = mainMenu.left;
  autoClaimSubMenu.width = mainMenu.width;
  autoClaimSubMenu.height = mainMenu.height;
  addLiquiditySubMenu.top = mainMenu.top;
  addLiquiditySubMenu.left = mainMenu.left;
  addLiquiditySubMenu.width = mainMenu.width;
  addLiquiditySubMenu.height = mainMenu.height;
  safeRender();
}

screen.on("resize", adjustLayout);
adjustLayout();

async function getTokenBalance(tokenAddress) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const balance = await contract.balanceOf(globalWallet.address);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    addLog(`Failed to fetch token balance ${tokenAddress}: ${error.message}`, "error");
    return "0";
  }
}

async function updateWalletData() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    globalWallet = wallet;
    liquidityContract = new ethers.Contract(
      LIQUIDITY_CONTRACT_ADDRESS,
      ADD_LIQUIDITY_ABI,
      globalWallet
    );
    walletInfo.address = wallet.address;
  
    const nativeBalance = await provider.getBalance(wallet.address);
    walletInfo.balanceNative = ethers.formatEther(nativeBalance);

    walletInfo.balanceWeth = await getTokenBalance(WETH_ADDRESS);
    walletInfo.balanceUsdc = await getTokenBalance(USDC_ADDRESS);
    walletInfo.balanceUni = await getTokenBalance(UNI_ADDRESS);
    walletInfo.balanceCrv = await getTokenBalance(CRV_ADDRESS);
    walletInfo.balanceDefi = await getTokenBalance(DEFI_ADDRESS);
    walletInfo.balanceSushi = await getTokenBalance(SUSHI_ADDRESS);

    updateWallet();
    addLog("Balance & Wallet Updated!", "system");
  } catch (error) {
    addLog("Failed to fetch wallet data: " + error.message, "system");
  }
}

function updateWallet() {
  const shortAddress = walletInfo.address ? getShortAddress(walletInfo.address) : "N/A";
  const native = walletInfo.balanceNative ? Number(walletInfo.balanceNative).toFixed(4) : "0.0000";
  const weth = walletInfo.balanceWeth ? Number(walletInfo.balanceWeth).toFixed(4) : "0.0000";
  const usdc = walletInfo.balanceUsdc ? Number(walletInfo.balanceUsdc).toFixed(2) : "0.00";
  const uni = walletInfo.balanceUni ? Number(walletInfo.balanceUni).toFixed(4) : "0.0000";
  const crv = walletInfo.balanceCrv ? Number(walletInfo.balanceCrv).toFixed(4) : "0.0000";
  const defi = walletInfo.balanceDefi ? Number(walletInfo.balanceDefi).toFixed(4) : "0.0000";
  const sushi = walletInfo.balanceSushi ? Number(walletInfo.balanceSushi).toFixed(4) : "0.0000";

  const content = `┌── Address   : {bright-yellow-fg}${shortAddress}{/bright-yellow-fg}
│   ├── ETH Native : {bright-green-fg}${native}{/bright-green-fg}
│   ├── WETH       : {bright-green-fg}${weth}{/bright-green-fg}
│   ├── USDC       : {bright-green-fg}${usdc}{/bright-green-fg}
│   ├── UNI        : {bright-green-fg}${uni}{/bright-green-fg}
│   ├── CRV        : {bright-green-fg}${crv}{/bright-green-fg}
│   ├── DEFI       : {bright-green-fg}${defi}{/bright-green-fg}
│   └── SUSHI      : {bright-green-fg}${sushi}{/bright-green-fg}
└── Network        : {bright-cyan-fg}${NETWORK_NAME}{/bright-cyan-fg}`;
  walletBox.setContent(content);
  safeRender();
}

async function estimateAmountOut(tokenIn, tokenOut, amountIn) {
  const tokenInContract = new ethers.Contract(tokenIn, ERC20ABI, provider);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20ABI, provider);
  const decimalsIn = await tokenInContract.decimals();
  const decimalsOut = await tokenOutContract.decimals();
  const amountInWei = ethers.parseUnits(amountIn.toString(), decimalsIn);

  let amountOut;
  if (tokenIn === WETH_ADDRESS && tokenOut === DEFI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 32.6).toString(), decimalsOut);
  } else if (tokenIn === DEFI_ADDRESS && tokenOut === WETH_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 0.010833).toString(), decimalsOut);
  } else if (tokenIn === SUSHI_ADDRESS && tokenOut === DEFI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 20).toString(), decimalsOut);
  } else if (tokenIn === DEFI_ADDRESS && tokenOut === SUSHI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 0.05).toString(), decimalsOut);
  } else if (tokenIn === CRV_ADDRESS && tokenOut === DEFI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 0.015).toString(), decimalsOut);
  } else if (tokenIn === DEFI_ADDRESS && tokenOut === CRV_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 66.67).toString(), decimalsOut);
  } else if (tokenIn === UNI_ADDRESS && tokenOut === DEFI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 2).toString(), decimalsOut);
  } else if (tokenIn === DEFI_ADDRESS && tokenOut === UNI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 0.5).toString(), decimalsOut);
  } else if (tokenIn === USDC_ADDRESS && tokenOut === DEFI_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 0.1).toString(), decimalsOut);
  } else if (tokenIn === DEFI_ADDRESS && tokenOut === USDC_ADDRESS) {
    amountOut = ethers.parseUnits((parseFloat(amountIn) * 10).toString(), decimalsOut);
  } else {
    throw new Error("Token pair not supported for estimation");
  }
  return amountOut;
}

async function autoSwapWETHDEFI() {
  const direction = lastSwapDirection === "WETH_TO_DEFI" ? "DEFI_TO_WETH" : "WETH_TO_DEFI";
  lastSwapDirection = direction;

  let tokenIn, tokenOut, minAmount, maxAmount, tokenInName, tokenOutName;

  if (direction === "WETH_TO_DEFI") {
    tokenIn = WETH_ADDRESS;
    tokenOut = DEFI_ADDRESS;
    minAmount = 0.05;
    maxAmount = 0.1;
    tokenInName = "WETH";
    tokenOutName = "DEFI";
  } else {
    tokenIn = DEFI_ADDRESS;
    tokenOut = WETH_ADDRESS;
    minAmount = 1;
    maxAmount = 3;
    tokenInName = "DEFI";
    tokenOutName = "WETH";
  }

  const amount = getRandomNumber(minAmount, maxAmount).toFixed(6);
  const balance = await getTokenBalance(tokenIn);

  if (parseFloat(balance) < parseFloat(amount)) {
    addLog(`Insufficient balance ${tokenInName}: ${balance} < ${amount}`, "warning");
    return;
  }

  const tokenInContract = new ethers.Contract(tokenIn, ERC20ABI, globalWallet);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20ABI, globalWallet);

  const decimalsIn = await tokenInContract.decimals();
  const decimalsOut = await tokenOutContract.decimals();
  const amountWei = ethers.parseUnits(amount, decimalsIn);

  const balanceOutBefore = await tokenOutContract.balanceOf(globalWallet.address);

  addLog(`Performing Swap ${amount} ${tokenInName} ➯ ${tokenOutName}`, "herafi");

  const allowance = await tokenInContract.allowance(globalWallet.address, SWAP_CONTRACT_ADDRESS);
  if (allowance < amountWei) {
    addLog(`Requesting Approval for ${amount} ${tokenInName}.`, "herafi");
    const approveTxFunction = async (nonce) => {
      const tx = await tokenInContract.approve(SWAP_CONTRACT_ADDRESS, amountWei, {
        gasLimit: 100000,
        nonce
      });
      addLog(`Approval transaction sent.`, "herafi");
      return tx;
    };
    const result = await addTransactionToQueue(approveTxFunction, `Approve ${amount} ${tokenInName}`);
    if (!result || !result.receipt || result.receipt.status !== 1) {
      addLog(`Approval failed for ${tokenInName}. Cancelling swap.`, "error");
      return;
    }
    addLog(`Approval Successful for ${amount} ${tokenInName}.`, "herafi");
  }

  let amountOutWei;
  try {
    amountOutWei = await estimateAmountOut(tokenIn, tokenOut, amount);
  } catch (error) {
    addLog(`Failed to estimate output. Using amountOutMin = 0.`, "warning");
    amountOutWei = ethers.parseUnits("0", decimalsOut);
  }

  const slippageTolerance = 0.99;
  const amountOutMinWei = (amountOutWei * BigInt(Math.floor(slippageTolerance * 10000))) / BigInt(10000);
  addLog(`AmountOutMin: ${ethers.formatUnits(amountOutMinWei, decimalsOut)} ${tokenOutName}`, "debug");

  let calldata;
  if (direction === "WETH_TO_DEFI") {
    const methodId = "0x29114e19";
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amountOutMinWei]);
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [tokenIn, amountWei, data]
    );
    calldata = methodId + encodedParams.slice(2);
  } else {
    const methodId = "0x392371ea";
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [amountWei, tokenOut, amountOutMinWei]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for DEFI_TO_WETH: ${calldata}`, "debug");
  }

  try {
    const simulationResult = await provider.call({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    addLog(`Transaction simulation successful: ${simulationResult}`, "debug");
  } catch (error) {
    addLog(`Transaction simulation failed: ${error.message}`, "error");
    return;
  }

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
    addLog(`Gas estimation: ${gasLimit}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate gas: ${error.message}. Using default 4500000.`, "warning");
    gasLimit = 4500000;
  }

  const swapTxFunction = async (nonce) => {
    const tx = await globalWallet.sendTransaction({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      gasLimit,
      nonce
    });
    addLog(`Tx Sent ${amount} ${tokenInName} ➯ ${tokenOutName}, Hash: ${getShortHash(tx.hash)}`, "herafi");
    return tx;
  };

  const result = await addTransactionToQueue(swapTxFunction, `Swap ${amount} ${direction}`);

  if (result && result.receipt && result.receipt.status === 1) {
    const balanceOutAfter = await tokenOutContract.balanceOf(globalWallet.address);
    const amountOut = Number(ethers.formatUnits(balanceOutAfter - balanceOutBefore, decimalsOut)).toFixed(4);
    addLog(`Swap Successful ${amount} ${tokenInName} ➯ ${amountOut} ${tokenOutName}, Hash: ${getShortHash(result.receipt.transactionHash || result.txHash)}`, "success");

    await reportTransaction(
      result.tx,
      direction,
      tokenIn,
      tokenOut,
      amount,
      amountOut,
      result.receipt
    );
  } else {
    addLog(`Failed to obtain receipt for swap ${direction}. Transaction may have failed or is pending.`, "error");
  }

  await updateWalletData();
}

async function autoSwapSUSHIDEFI() {
  const direction = lastSwapDirectionSushi === "SUSHI_TO_DEFI" ? "DEFI_TO_SUSHI" : "SUSHI_TO_DEFI";
  lastSwapDirectionSushi = direction;

  let tokenIn, tokenOut, minAmount, maxAmount, tokenInName, tokenOutName;

  if (direction === "SUSHI_TO_DEFI") {
    tokenIn = SUSHI_ADDRESS;
    tokenOut = DEFI_ADDRESS;
    minAmount = 0.05;
    maxAmount = 0.1;
    tokenInName = "SUSHI";
    tokenOutName = "DEFI";
  } else {
    tokenIn = DEFI_ADDRESS;
    tokenOut = SUSHI_ADDRESS;
    minAmount = 1;
    maxAmount = 3;
    tokenInName = "DEFI";
    tokenOutName = "SUSHI";
  }

  const amount = getRandomNumber(minAmount, maxAmount).toFixed(6);
  const balance = await getTokenBalance(tokenIn);

  if (parseFloat(balance) < parseFloat(amount)) {
    addLog(`Insufficient balance for ${tokenInName}: ${balance} < ${amount}`, "warning");
    return;
  }

  const tokenInContract = new ethers.Contract(tokenIn, ERC20ABI, globalWallet);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20ABI, globalWallet);

  const decimalsIn = await tokenInContract.decimals();
  const decimalsOut = await tokenOutContract.decimals();
  const amountWei = ethers.parseUnits(amount, decimalsIn);

  const balanceOutBefore = await tokenOutContract.balanceOf(globalWallet.address);

  addLog(`Performing Swap ${amount} ${tokenInName} ➯ ${tokenOutName}`, "herafi");

  const allowance = await tokenInContract.allowance(globalWallet.address, SWAP_CONTRACT_ADDRESS);
  if (allowance < amountWei) {
    addLog(`Requesting Approval for ${amount} ${tokenInName}.`, "herafi");
    const approveTxFunction = async (nonce) => {
      const tx = await tokenInContract.approve(SWAP_CONTRACT_ADDRESS, amountWei, {
        gasLimit: 100000,
        nonce
      });
      addLog(`Approval transaction sent.`, "herafi");
      return tx;
    };
    const result = await addTransactionToQueue(approveTxFunction, `Approve ${amount} ${tokenInName}`);
    if (!result || !result.receipt || result.receipt.status !== 1) {
      addLog(`Approval failed for ${tokenInName}. Cancelling swap.`, "error");
      return;
    }
    addLog(`Approval Successful for ${amount} ${tokenInName}.`, "herafi");
  }

  let amountOutWei;
  try {
    amountOutWei = await estimateAmountOut(tokenIn, tokenOut, amount);
    addLog(`Estimated output: ${ethers.formatUnits(amountOutWei, decimalsOut)} ${tokenOutName}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate output. Using amountOutMin = 0.`, "warning");
    amountOutWei = ethers.parseUnits("0", decimalsOut);
  }

  const slippageTolerance = 0.99;
  const amountOutMinWei = (amountOutWei * BigInt(Math.floor(slippageTolerance * 10000))) / BigInt(10000);
  addLog(`AmountOutMin: ${ethers.formatUnits(amountOutMinWei, decimalsOut)} ${tokenOutName}`, "debug");

  let calldata;
  if (direction === "SUSHI_TO_DEFI") {
    const methodId = "0x29114e19";
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amountOutMinWei]);
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [tokenIn, amountWei, data]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for SUSHI_TO_DEFI: ${calldata}`, "debug");
  } else {
    const methodId = "0x392371ea";
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [amountWei, tokenOut, amountOutMinWei]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for DEFI_TO_SUSHI: ${calldata}`, "debug");
  }

  try {
    const simulationResult = await provider.call({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    addLog(`Transaction simulation successful: ${simulationResult}`, "debug");
  } catch (error) {
    addLog(`Transaction simulation failed: ${error.message}`, "error");
    return;
  }

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
    addLog(`Gas estimation: ${gasLimit}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate gas: ${error.message}. Using default 4500000.`, "warning");
    gasLimit = 4500000;
  }

  const swapTxFunction = async (nonce) => {
    const tx = await globalWallet.sendTransaction({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      gasLimit,
      nonce
    });
    addLog(`Tx Sent ${amount} ${tokenInName} ➯ ${tokenOutName}, Hash: ${getShortHash(tx.hash)}`, "herafi");
    return tx;
  };

  const result = await addTransactionToQueue(swapTxFunction, `Swap ${amount} ${direction}`);

  if (result && result.receipt && result.receipt.status === 1) {
    const balanceOutAfter = await tokenOutContract.balanceOf(globalWallet.address);
    const amountOut = Number(ethers.formatUnits(balanceOutAfter - balanceOutBefore, decimalsOut)).toFixed(4);
    addLog(`Swap Successful ${amount} ${tokenInName} -> ${amountOut} ${tokenOutName}, Hash: ${getShortHash(result.receipt.transactionHash || result.txHash)}`, "success");

    await reportTransaction(
      result.tx,
      direction,
      tokenIn,
      tokenOut,
      amount,
      amountOut,
      result.receipt
    );
  } else {
    addLog(`Failed to obtain receipt for swap ${direction}. Transaction may have failed or is pending.`, "error");
  }

  await updateWalletData();
}

async function autoSwapCRVDEFI() {
  const direction = lastSwapDirectionCrv === "CRV_TO_DEFI" ? "DEFI_TO_CRV" : "CRV_TO_DEFI";
  lastSwapDirectionCrv = direction;

  let tokenIn, tokenOut, minAmount, maxAmount, tokenInName, tokenOutName;

  if (direction === "CRV_TO_DEFI") {
    tokenIn = CRV_ADDRESS;
    tokenOut = DEFI_ADDRESS;
    minAmount = 50;
    maxAmount = 70;
    tokenInName = "CRV";
    tokenOutName = "DEFI";
  } else {
    tokenIn = DEFI_ADDRESS;
    tokenOut = CRV_ADDRESS;
    minAmount = 0.7;
    maxAmount = 1;
    tokenInName = "DEFI";
    tokenOutName = "CRV";
  }

  const amount = getRandomNumber(minAmount, maxAmount).toFixed(6);
  const balance = await getTokenBalance(tokenIn);

  if (parseFloat(balance) < parseFloat(amount)) {
    addLog(`Insufficient balance for ${tokenInName}: ${balance} < ${amount}`, "warning");
    return;
  }

  const tokenInContract = new ethers.Contract(tokenIn, ERC20ABI, globalWallet);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20ABI, globalWallet);

  const decimalsIn = await tokenInContract.decimals();
  const decimalsOut = await tokenOutContract.decimals();
  const amountWei = ethers.parseUnits(amount, decimalsIn);

  const balanceOutBefore = await tokenOutContract.balanceOf(globalWallet.address);

  addLog(`Performing Swap ${amount} ${tokenInName} ➯ ${tokenOutName}`, "herafi");

  const allowance = await tokenInContract.allowance(globalWallet.address, SWAP_CONTRACT_ADDRESS);
  if (allowance < amountWei) {
    addLog(`Requesting Approval for ${amount} ${tokenInName}.`, "herafi");
    const approveTxFunction = async (nonce) => {
      const tx = await tokenInContract.approve(SWAP_CONTRACT_ADDRESS, amountWei, {
        gasLimit: 100000,
        nonce
      });
      addLog(`Approval transaction sent.`, "herafi");
      return tx;
    };
    const result = await addTransactionToQueue(approveTxFunction, `Approve ${amount} ${tokenInName}`);
    if (!result || !result.receipt || result.receipt.status !== 1) {
      addLog(`Approval failed for ${tokenInName}. Cancelling swap.`, "error");
      return;
    }
    addLog(`Approval Successful for ${amount} ${tokenInName}.`, "herafi");
  }

  let amountOutWei;
  try {
    amountOutWei = await estimateAmountOut(tokenIn, tokenOut, amount);
    addLog(`Estimated output: ${ethers.formatUnits(amountOutWei, decimalsOut)} ${tokenOutName}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate output. Using amountOutMin = 0.`, "warning");
    amountOutWei = ethers.parseUnits("0", decimalsOut);
  }

  const slippageTolerance = 0.99;
  const amountOutMinWei = (amountOutWei * BigInt(Math.floor(slippageTolerance * 10000))) / BigInt(10000);
  addLog(`AmountOutMin: ${ethers.formatUnits(amountOutMinWei, decimalsOut)} ${tokenOutName}`, "debug");

  let calldata;
  if (direction === "CRV_TO_DEFI") {
    const methodId = "0x29114e19";
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amountOutMinWei]);
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [tokenIn, amountWei, data]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for CRV_TO_DEFI: ${calldata}`, "debug");
  } else {
    const methodId = "0x392371ea";
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [amountWei, tokenOut, amountOutMinWei]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for DEFI_TO_CRV: ${calldata}`, "debug");
  }

  try {
    const simulationResult = await provider.call({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    addLog(`Transaction simulation successful: ${simulationResult}`, "debug");
  } catch (error) {
    addLog(`Transaction simulation failed: ${error.message}`, "error");
    return;
  }

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
    addLog(`Gas estimation: ${gasLimit}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate gas: ${error.message}. Using default 4500000.`, "warning");
    gasLimit = 4500000;
  }

  const swapTxFunction = async (nonce) => {
    const tx = await globalWallet.sendTransaction({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      gasLimit,
      nonce
    });
    addLog(`Tx Sent ${amount} ${tokenInName} ➯ ${tokenOutName}, Hash: ${getShortHash(tx.hash)}`, "herafi");
    return tx;
  };

  const result = await addTransactionToQueue(swapTxFunction, `Swap ${amount} ${direction}`);

  if (result && result.receipt && result.receipt.status === 1) {
    const balanceOutAfter = await tokenOutContract.balanceOf(globalWallet.address);
    const amountOut = Number(ethers.formatUnits(balanceOutAfter - balanceOutBefore, decimalsOut)).toFixed(4);
    addLog(`Swap Successful ${amount} ${tokenInName} ➯ ${amountOut} ${tokenOutName}, Hash: ${getShortHash(result.receipt.transactionHash || result.txHash)}`, "success");

    await reportTransaction(
      result.tx,
      direction,
      tokenIn,
      tokenOut,
      amount,
      amountOut,
      result.receipt
    );
  } else {
    addLog(`Failed to obtain receipt for swap ${direction}. Transaction may have failed or is pending.`, "error");
  }

  await updateWalletData();
}

async function autoSwapUNIDEFI() {
  const direction = lastSwapDirectionUni === "UNI_TO_DEFI" ? "DEFI_TO_UNI" : "UNI_TO_DEFI";
  lastSwapDirectionUni = direction;

  let tokenIn, tokenOut, minAmount, maxAmount, tokenInName, tokenOutName;

  if (direction === "UNI_TO_DEFI") {
    tokenIn = UNI_ADDRESS;
    tokenOut = DEFI_ADDRESS;
    minAmount = 5;
    maxAmount = 10;
    tokenInName = "UNI";
    tokenOutName = "DEFI";
  } else {
    tokenIn = DEFI_ADDRESS;
    tokenOut = UNI_ADDRESS;
    minAmount = 0.5;
    maxAmount = 1;
    tokenInName = "DEFI";
    tokenOutName = "UNI";
  }

  const amount = getRandomNumber(minAmount, maxAmount).toFixed(6);
  const balance = await getTokenBalance(tokenIn);

  if (parseFloat(balance) < parseFloat(amount)) {
    addLog(`Insufficient balance for ${tokenInName}: ${balance} < ${amount}`, "warning");
    return;
  }

  const tokenInContract = new ethers.Contract(tokenIn, ERC20ABI, globalWallet);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20ABI, globalWallet);

  const decimalsIn = await tokenInContract.decimals();
  const decimalsOut = await tokenOutContract.decimals();
  const amountWei = ethers.parseUnits(amount, decimalsIn);

  const balanceOutBefore = await tokenOutContract.balanceOf(globalWallet.address);

  addLog(`Performing Swap: ${amount} ${tokenInName} ➯ ${tokenOutName}`, "herafi");

  const allowance = await tokenInContract.allowance(globalWallet.address, SWAP_CONTRACT_ADDRESS);
  if (allowance < amountWei) {
    addLog(`Requesting Approval for ${amount} ${tokenInName}.`, "herafi");
    const approveTxFunction = async (nonce) => {
      const tx = await tokenInContract.approve(SWAP_CONTRACT_ADDRESS, amountWei, {
        gasLimit: 100000,
        nonce
      });
      addLog(`Approval transaction sent.`, "herafi");
      return tx;
    };
    const result = await addTransactionToQueue(approveTxFunction, `Approve ${amount} ${tokenInName}`);
    if (!result || !result.receipt || result.receipt.status !== 1) {
      addLog(`Approval failed for ${tokenInName}. Cancelling swap.`, "error");
      return;
    }
    addLog(`Approval Successful.`, "herafi");
  }

  let amountOutWei;
  try {
    amountOutWei = await estimateAmountOut(tokenIn, tokenOut, amount);
    addLog(`Estimated output: ${ethers.formatUnits(amountOutWei, decimalsOut)} ${tokenOutName}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate output. Using amountOutMin = 0.`, "warning");
    amountOutWei = ethers.parseUnits("0", decimalsOut);
  }

  const slippageTolerance = 0.99;
  const amountOutMinWei = (amountOutWei * BigInt(Math.floor(slippageTolerance * 10000))) / BigInt(10000);
  addLog(`AmountOutMin: ${ethers.formatUnits(amountOutMinWei, decimalsOut)} ${tokenOutName}`, "debug");

  let calldata;
  if (direction === "UNI_TO_DEFI") {
    const methodId = "0x29114e19";
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amountOutMinWei]);
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [tokenIn, amountWei, data]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for UNI_TO_DEFI: ${calldata}`, "debug");
  } else {
    const methodId = "0x392371ea";
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [amountWei, tokenOut, amountOutMinWei]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for DEFI_TO_UNI: ${calldata}`, "debug");
  }

  try {
    const simulationResult = await provider.call({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    addLog(`Transaction simulation successful: ${simulationResult}`, "debug");
  } catch (error) {
    addLog(`Transaction simulation failed: ${error.message}`, "error");
    return;
  }

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
    addLog(`Gas estimation: ${gasLimit}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate gas: ${error.message}. Using default 4500000.`, "warning");
    gasLimit = 4500000;
  }

  const swapTxFunction = async (nonce) => {
    const tx = await globalWallet.sendTransaction({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      gasLimit,
      nonce
    });
    addLog(`Tx Sent: ${amount} ${tokenInName} ➯ ${tokenOutName}, Hash: ${getShortHash(tx.hash)}`, "herafi");
    return tx;
  };

  const result = await addTransactionToQueue(swapTxFunction, `Swap ${amount} ${direction}`);

  if (result && result.receipt && result.receipt.status === 1) {
    const balanceOutAfter = await tokenOutContract.balanceOf(globalWallet.address);
    const amountOut = Number(ethers.formatUnits(balanceOutAfter - balanceOutBefore, decimalsOut)).toFixed(4);
    addLog(`Swap Successful ${amount} ${tokenInName} ➯ ${amountOut} ${tokenOutName}, Hash: ${getShortHash(result.receipt.transactionHash || result.txHash)}`, "success");

    await reportTransaction(
      result.tx,
      direction,
      tokenIn,
      tokenOut,
      amount,
      amountOut,
      result.receipt
    );
  } else {
    addLog(`Failed to obtain receipt for swap ${direction}. Transaction may have failed or is pending.`, "error");
  }

  await updateWalletData();
}

async function autoSwapUSDCDEFI() {
  const direction = lastSwapDirectionUsdc === "USDC_TO_DEFI" ? "DEFI_TO_USDC" : "USDC_TO_DEFI";
  lastSwapDirectionUsdc = direction;

  let tokenIn, tokenOut, minAmount, maxAmount, tokenInName, tokenOutName;

  if (direction === "USDC_TO_DEFI") {
    tokenIn = USDC_ADDRESS;
    tokenOut = DEFI_ADDRESS;
    minAmount = 30;
    maxAmount = 60;
    tokenInName = "USDC";
    tokenOutName = "DEFI";
  } else {
    tokenIn = DEFI_ADDRESS;
    tokenOut = USDC_ADDRESS;
    minAmount = 0.5;
    maxAmount = 1;
    tokenInName = "DEFI";
    tokenOutName = "USDC";
  }

  const amount = getRandomNumber(minAmount, maxAmount).toFixed(6);
  const balance = await getTokenBalance(tokenIn);

  if (parseFloat(balance) < parseFloat(amount)) {
    addLog(`Insufficient balance for ${tokenInName}: ${balance} < ${amount}`, "warning");
    return;
  }

  const tokenInContract = new ethers.Contract(tokenIn, ERC20ABI, globalWallet);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20ABI, globalWallet);

  const decimalsIn = await tokenInContract.decimals();
  const decimalsOut = await tokenOutContract.decimals();
  const amountWei = ethers.parseUnits(amount, decimalsIn);

  const balanceOutBefore = await tokenOutContract.balanceOf(globalWallet.address);

  addLog(`Performing Swap ${amount} ${tokenInName} ➯ ${tokenOutName}`, "herafi");

  const allowance = await tokenInContract.allowance(globalWallet.address, SWAP_CONTRACT_ADDRESS);
  if (allowance < amountWei) {
    addLog(`Requesting Approval for ${amount} ${tokenInName}.`, "herafi");
    const approveTxFunction = async (nonce) => {
      const tx = await tokenInContract.approve(SWAP_CONTRACT_ADDRESS, amountWei, {
        gasLimit: 100000,
        nonce
      });
      addLog(`Approval transaction sent.`, "herafi");
      return tx;
    };
    const result = await addTransactionToQueue(approveTxFunction, `Approve ${amount} ${tokenInName}`);
    if (!result || !result.receipt || result.receipt.status !== 1) {
      addLog(`Approval failed for ${tokenInName}. Cancelling swap.`, "error");
      return;
    }
    addLog(`Approval Successful.`, "herafi");
  }

  let amountOutWei;
  try {
    amountOutWei = await estimateAmountOut(tokenIn, tokenOut, amount);
    addLog(`Estimated output: ${ethers.formatUnits(amountOutWei, decimalsOut)} ${tokenOutName}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate output. Using amountOutMin = 0.`, "warning");
    amountOutWei = ethers.parseUnits("0", decimalsOut);
  }

  const slippageTolerance = 0.99;
  const amountOutMinWei = (amountOutWei * BigInt(Math.floor(slippageTolerance * 10000))) / BigInt(10000);
  addLog(`AmountOutMin: ${ethers.formatUnits(amountOutMinWei, decimalsOut)} ${tokenOutName}`, "debug");

  let calldata;
  if (direction === "USDC_TO_DEFI") {
    const methodId = "0x29114e19";
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amountOutMinWei]);
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [tokenIn, amountWei, data]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for USDC_TO_DEFI: ${calldata}`, "debug");
  } else {
    const methodId = "0x392371ea";
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256"],
      [amountWei, tokenOut, amountOutMinWei]
    );
    calldata = methodId + encodedParams.slice(2);
    addLog(`Generated calldata for DEFI_TO_USDC: ${calldata}`, "debug");
  }

  try {
    const simulationResult = await provider.call({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    addLog(`Transaction simulation successful: ${simulationResult}`, "debug");
  } catch (error) {
    addLog(`Transaction simulation failed: ${error.message}`, "error");
    return;
  }

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      from: globalWallet.address
    });
    gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
    addLog(`Gas estimation: ${gasLimit}`, "debug");
  } catch (error) {
    addLog(`Failed to estimate gas: ${error.message}. Using default 4500000.`, "warning");
    gasLimit = 4500000;
  }

  const swapTxFunction = async (nonce) => {
    const tx = await globalWallet.sendTransaction({
      to: SWAP_CONTRACT_ADDRESS,
      data: calldata,
      gasLimit,
      nonce
    });
    addLog(`Tx Sent ${amount} ${tokenInName} ➯ ${tokenOutName}, Hash: ${getShortHash(tx.hash)}`, "herafi");
    return tx;
  };

  const result = await addTransactionToQueue(swapTxFunction, `Swap ${amount} ${direction}`);

  if (result && result.receipt && result.receipt.status === 1) {
    const balanceOutAfter = await tokenOutContract.balanceOf(globalWallet.address);
    const amountOut = Number(ethers.formatUnits(balanceOutAfter - balanceOutBefore, decimalsOut)).toFixed(4);
    addLog(`Swap Successful ${amount} ${tokenInName} ➯ ${amountOut} ${tokenOutName}, Hash: ${getShortHash(result.receipt.transactionHash || result.txHash)}`, "success");

    await reportTransaction(
      result.tx,
      direction,
      tokenIn,
      tokenOut,
      amount,
      amountOut,
      result.receipt
    );
  } else {
    addLog(`Failed to obtain receipt for swap ${direction}. Transaction may have failed or is pending.`, "error");
  }

  await updateWalletData();
}

async function runAutoSwapWETHDEFI() {
  promptBox.setFront();
  promptBox.readInput("Enter the number of WETH & DEFI swaps", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("HeraFI Swap: Invalid input or cancelled.", "herafi");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("HeraFI Swap: Input must be a number.", "herafi");
      return;
    }
    addLog(`HeraFI Swap: Starting ${loopCount} iterations of WETH & DEFI swaps.`, "herafi");

    heraFISwapRunning = true;
    heraFISwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    heraFISwapSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (heraFISwapCancelled) {
        addLog(`HeraFI: Auto Swap WETH & DEFI Stopped at Cycle ${i}.`, "herafi");
        break;
      }
      addLog(`Starting swap ${i}: Direction ${lastSwapDirection === "WETH_TO_DEFI" ? "DEFI_TO_WETH" : "WETH_TO_DEFI"}`, "herafi");
      await autoSwapWETHDEFI();
      if (i < loopCount) {
        const delayTime = getRandomDelay();
        const minutes = Math.floor(delayTime / 60000);
        const seconds = Math.floor((delayTime % 60000) / 1000);
        addLog(`Swap ${i} completed. Waiting ${minutes} minutes ${seconds} seconds.`, "herafi");
        await waitWithCancel(delayTime, "swap");
        if (heraFISwapCancelled) {
          addLog("HeraFI Swap: Stopped during wait period.", "herafi");
          break;
        }
      }
    }
    heraFISwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    safeRender();
    addLog("HeraFI Swap: Auto Swap WETH & DEFI completed.", "herafi");
  });
}

async function runAutoSwapSUSHIDEFI() {
  promptBox.setFront();
  promptBox.readInput("Enter the number of SUSHI & DEFI swaps", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("HeraFI Swap: Invalid input or cancelled.", "herafi");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("HeraFI Swap: Input must be a number.", "herafi");
      return;
    }
    addLog(`HeraFI Swap: Starting ${loopCount} iterations of SUSHI & DEFI swaps.`, "herafi");

    heraFISwapRunning = true;
    heraFISwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    heraFISwapSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (heraFISwapCancelled) {
        addLog(`HeraFI: Auto Swap SUSHI & DEFI Stopped at Cycle ${i}.`, "herafi");
        break;
      }
      addLog(`Starting swap ${i}: Direction ${lastSwapDirectionSushi === "SUSHI_TO_DEFI" ? "DEFI_TO_SUSHI" : "SUSHI_TO_DEFI"}`, "herafi");
      await autoSwapSUSHIDEFI();
      if (i < loopCount) {
        const delayTime = getRandomDelay();
        const minutes = Math.floor(delayTime / 60000);
        const seconds = Math.floor((delayTime % 60000) / 1000);
        addLog(`Swap ${i} completed. Waiting ${minutes} minutes ${seconds} seconds.`, "herafi");
        await waitWithCancel(delayTime, "swap");
        if (heraFISwapCancelled) {
          addLog("HeraFI Swap: Stopped during wait period.", "herafi");
          break;
        }
      }
    }
    heraFISwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    safeRender();
    addLog("HeraFI Swap: Auto Swap SUSHI & DEFI completed.", "herafi");
  });
}

async function runAutoSwapCRVDEFI() {
  promptBox.setFront();
  promptBox.readInput("Enter the number of CRV & DEFI swaps", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("HeraFI Swap: Invalid input or cancelled.", "herafi");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("HeraFI Swap: Input must be a number.", "herafi");
      return;
    }
    addLog(`HeraFI Swap: Starting ${loopCount} iterations of CRV & DEFI swaps.`, "herafi");

    heraFISwapRunning = true;
    heraFISwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    heraFISwapSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (heraFISwapCancelled) {
        addLog(`HeraFI: Auto Swap CRV & DEFI Stopped at Cycle ${i}.`, "herafi");
        break;
      }
      addLog(`Starting swap ${i}: Direction ${lastSwapDirectionCrv === "CRV_TO_DEFI" ? "DEFI_TO_CRV" : "CRV_TO_DEFI"}`, "herafi");
      await autoSwapCRVDEFI();
      if (i < loopCount) {
        const delayTime = getRandomDelay();
        const minutes = Math.floor(delayTime / 60000);
        const seconds = Math.floor((delayTime % 60000) / 1000);
        addLog(`Swap ${i} completed. Waiting ${minutes} minutes ${seconds} seconds.`, "herafi");
        await waitWithCancel(delayTime, "swap");
        if (heraFISwapCancelled) {
          addLog("HeraFI Swap: Stopped during wait period.", "herafi");
          break;
        }
      }
    }
    heraFISwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    safeRender();
    addLog("HeraFI Swap: Auto Swap CRV & DEFI completed.", "herafi");
  });
}

async function runAutoSwapUNIDEFI() {
  promptBox.setFront();
  promptBox.readInput("Enter the number of UNI & DEFI swaps", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("HeraFI Swap: Invalid input or cancelled.", "herafi");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("HeraFI Swap: Input must be a number.", "herafi");
      return;
    }
    addLog(`HeraFI Swap: Starting ${loopCount} iterations of UNI & DEFI swaps.`, "herafi");

    heraFISwapRunning = true;
    heraFISwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    heraFISwapSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (heraFISwapCancelled) {
        addLog(`HeraFI: Auto Swap UNI & DEFI Stopped at Cycle ${i}.`, "herafi");
        break;
      }
      addLog(`Starting swap ${i}: Direction ${lastSwapDirectionUni === "UNI_TO_DEFI" ? "DEFI_TO_UNI" : "UNI_TO_DEFI"}`, "herafi");
      await autoSwapUNIDEFI();
      if (i < loopCount) {
        const delayTime = getRandomDelay();
        const minutes = Math.floor(delayTime / 60000);
        const seconds = Math.floor((delayTime % 60000) / 1000);
        addLog(`Swap ${i} completed. Waiting ${minutes} minutes ${seconds} seconds.`, "herafi");
        await waitWithCancel(delayTime, "swap");
        if (heraFISwapCancelled) {
          addLog("HeraFI Swap: Stopped during wait period.", "herafi");
          break;
        }
      }
    }
    heraFISwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    safeRender();
    addLog("HeraFI Swap: Auto Swap UNI & DEFI completed.", "herafi");
  });
}

async function runAutoSwapUSDCDEFI() {
  promptBox.setFront();
  promptBox.readInput("Enter the number of USDC & DEFI swaps", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("HeraFI Swap: Invalid input or cancelled.", "herafi");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("HeraFI Swap: Input must be a number.", "herafi");
      return;
    }
    addLog(`HeraFI Swap: Starting ${loopCount} iterations of USDC & DEFI swaps.`, "herafi");

    heraFISwapRunning = true;
    heraFISwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    heraFISwapSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (heraFISwapCancelled) {
        addLog(`HeraFI: Auto Swap USDC & DEFI Stopped at Cycle ${i}.`, "herafi");
        break;
      }
      addLog(`Starting swap ${i}: Direction ${lastSwapDirectionUsdc === "USDC_TO_DEFI" ? "DEFI_TO_USDC" : "USDC_TO_DEFI"}`, "herafi");
      await autoSwapUSDCDEFI();
      if (i < loopCount) {
        const delayTime = getRandomDelay();
        const minutes = Math.floor(delayTime / 60000);
        const seconds = Math.floor((delayTime % 60000) / 1000);
        addLog(`Swap ${i} completed. Waiting ${minutes} minutes ${seconds} seconds.`, "herafi");
        await waitWithCancel(delayTime, "swap");
        if (heraFISwapCancelled) {
          addLog("HeraFI Swap: Stopped during wait period.", "herafi");
          break;
        }
      }
    }
    heraFISwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    heraFISwapSubMenu.setItems(getHeraFISwapMenuItems());
    safeRender();
    addLog("HeraFI Swap: Auto Swap USDC & DEFI completed.", "herafi");
  });
}

async function runAutoClaimFaucet() {
  if (autoClaimRunning) {
    addLog("Auto Claim Faucet: Process is already running. Stop the transaction first.", "warning");
    return;
  }

  addLog("Auto Claim Faucet: Starting faucet claim for all tokens.", "faucet");

  autoClaimRunning = true;
  autoClaimCancelled = false;
  mainMenu.setItems(getMainMenuItems());
  autoClaimSubMenu.setItems(getAutoClaimMenuItems());
  autoClaimSubMenu.show();
  safeRender();

  const faucetContract = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, globalWallet);

  const tokens = [
    { address: WETH_ADDRESS, name: "WETH" },
    { address: USDC_ADDRESS, name: "USDC" },
    { address: UNI_ADDRESS, name: "UNI" },
    { address: CRV_ADDRESS, name: "CRV" },
    { address: SUSHI_ADDRESS, name: "SUSHI" }
  ];

  for (const token of tokens) {
    if (autoClaimCancelled) {
      addLog("Auto Claim Faucet: Process cancelled.", "faucet");
      break;
    }
    try {
      const limit = await faucetContract.tokenLimits(token.address);
if (limit == 0) {
  addLog(`Auto Claim Faucet: Token ${token.name} has a zero limit.`, "warning");
  continue;
}

const data = "0x9c68d737" +
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [globalWallet.address, token.address]
  ).slice(2);
const result = await provider.call({ to: FAUCET_ADDRESS, data });
const lastClaimTime = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], result)[0];
const currentTime = Math.floor(Date.now() / 1000);

if (lastClaimTime > 0 && currentTime <= Number(lastClaimTime) + 1800) {
  const timeLeft = Math.floor((1800 - (currentTime - Number(lastClaimTime))) / 60);
  addLog(`Auto Claim Faucet: Cooldown ${token.name}: ${timeLeft} minutes remaining.`, "warning");
  continue;
}

const tokenContract = new ethers.Contract(token.address, ERC20ABI, globalWallet);
const contractBalance = await tokenContract.balanceOf(FAUCET_ADDRESS);
if (contractBalance < limit) {
  addLog(`Auto Claim Faucet: Contract balance is insufficient for ${token.name}.`, "warning");
  continue;
}

const txFunction = async (nonce) => {
  const tx = await faucetContract.requestToken(token.address, limit, {
    gasLimit: 200000,
    nonce
  });
  addLog(`Auto Claim Faucet: Transaction sent for ${token.name}. Hash: ${getShortHash(tx.hash)}`, "faucet");
  return tx;
};
await addTransactionToQueue(txFunction, `Claim ${token.name} Faucet`);
} catch (error) {
  addLog(`Auto Claim Faucet: Failed to claim ${token.name}: ${error.message}`, "error");
}
await waitWithCancel(2000, "faucet");
}

if (!autoClaimCancelled) {
  addLog("Auto Claim Faucet: Faucet claim process completed.", "faucet");
  await updateWalletData();
}

autoClaimRunning = false;
mainMenu.setItems(getMainMenuItems());
autoClaimSubMenu.setItems(getAutoClaimMenuItems());
safeRender();
}

const tokensForLiquidity = [
  { name: "WETH", address: WETH_ADDRESS },
  { name: "USDC", address: USDC_ADDRESS },
  { name: "UNI", address: UNI_ADDRESS },
  { name: "CRV", address: CRV_ADDRESS },
  { name: "SUSHI", address: SUSHI_ADDRESS }
];

function getTokenName(tokenAddress) {
  const token = tokensForLiquidity.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return token ? token.name : "Unknown Token";
}

async function reportLiquidityTransaction(payload) {
  const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnaWZ3aGt1YWh0aXR3dmNsYW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyOTU0NTUsImV4cCI6MjA1Njg3MTQ1NX0.rPH6IVNsblq_rIwnAE8dNdKPtBtuY7MkKMi67Ut8KVA";
  const authorization = `Bearer ${apiKey}`;

  try {
    const response = await axios.post("https://hgifwhkuahtitwvclank.supabase.co/rest/v1/liquidity_transactions?select=*", payload, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
        "Authorization": authorization
      }
    });
    addLog(`Liquidity Transaction Report Successfully Sent`, "success");
  } catch (error) {
    let errorMessage = error.message;
    if (error.response) {
      errorMessage += ` | Status: ${error.response.status} | Data: ${JSON.stringify(error.response.data)}`;
    }
    addLog(`Failed to Send Liquidity Transaction Report: ${errorMessage}`, "error");
  }
}

async function addLiquidity(tokenAddress, amount) {
  try {
    if (!liquidityContract) {
      addLog("liquidityContract has not been initialized.", "error");
      return null;
    }

    let hasProvideLiquidity = false;
    try {
      liquidityContract.interface.getFunction("provideLiquidity");
      hasProvideLiquidity = true;
      addLog("provideLiquidity function is available in liquidityContract.", "debug");
    } catch (error) {
      addLog(`provideLiquidity function is not available: ${error.message}`, "error");
    }

    const tokenName = getTokenName(tokenAddress);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, globalWallet);
    const decimals = await tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);
    const allowance = await tokenContract.allowance(globalWallet.address, LIQUIDITY_CONTRACT_ADDRESS);
    if (allowance < amountWei) {
      addLog(`Starting approval for ${amount} ${tokenName}.`, "system");
      const approveTxFunction = async (nonce) => {
        const tx = await tokenContract.approve(LIQUIDITY_CONTRACT_ADDRESS, amountWei, {
          gasLimit: 100000,
          nonce
        });
        addLog(`Approval transaction sent: ${getShortHash(tx.hash)}`, "system");
        return tx;
      };
      const approveResult = await addTransactionToQueue(approveTxFunction, `Approve ${amount} ${tokenName} for liquidity`);
      if (!approveResult || !approveResult.receipt || approveResult.receipt.status !== 1) {
        addLog(`Approval failed for ${amount} ${tokenName}.`, "error");
        return null;
      }
      addLog(`Approval successful for ${amount} ${tokenName}.`, "system");
    }
    let gasLimit;
    if (hasProvideLiquidity) {
      try {
        gasLimit = await liquidityContract.estimateGas.provideLiquidity(tokenAddress, amountWei);
        gasLimit = (gasLimit * BigInt(120)) / BigInt(100);
        addLog(`Gas estimation for provideLiquidity: ${gasLimit}`, "debug");
      } catch (error) {
        gasLimit = 1500000;
      }
    } else {
      addLog("provideLiquidity function is not available. Using default gasLimit 1500000.", "warning");
      gasLimit = 1500000;
    }

    try {
      const simulationResult = await provider.call({
        to: LIQUIDITY_CONTRACT_ADDRESS,
        data: liquidityContract.interface.encodeFunctionData("provideLiquidity", [tokenAddress, amountWei]),
        from: globalWallet.address
      });
      addLog(`provideLiquidity simulation successful: ${simulationResult}`, "debug");
    } catch (error) {
      addLog(`provideLiquidity simulation failed: ${error.message}`, "error");
      return null;
    }

    const addLiquidityTxFunction = async (nonce) => {
      const tx = await liquidityContract.provideLiquidity(tokenAddress, amountWei, {
        gasLimit,
        nonce
      });
      addLog(`Transaction sent: Provide Liquidity for ${amount} ${tokenName}`, "success");
      return tx;
    };
    const result = await addTransactionToQueue(addLiquidityTxFunction, `Provide Liquidity ${amount} ${tokenName}`);
    if (result && result.receipt && result.receipt.status === 1) {
      const txHash = result.receipt.transactionHash || result.txHash;
      addLog(`Liquidity added successfully. Tx Hash: ${getShortHash(txHash)}`, "success");

      const walletAddress = globalWallet.address;
      const transactionType = "add";
      const tokenSymbol = tokenName;
      const tokenAmount = amountWei.toString();

      const tokenPriceUsd = "1";
      const totalValueUsd = (parseFloat(amount) * parseFloat(tokenPriceUsd)).toString();
      const lpTokens = tokenAmount;
      const feeAmountUsd = "0";

      const transactionHash = txHash;
      const blockNumber = result.receipt.blockNumber;
      const block = await provider.getBlock(blockNumber);
      const blockTimestamp = new Date(block.timestamp * 1000).toISOString();

      const payload = {
        wallet_address: walletAddress,
        transaction_type: transactionType,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        token_amount: tokenAmount,
        token_price_usd: tokenPriceUsd,
        total_value_usd: totalValueUsd,
        lp_tokens: lpTokens,
        fee_amount_usd: feeAmountUsd,
        transaction_hash: transactionHash,
        block_number: blockNumber,
        block_timestamp: blockTimestamp
      };

      await reportLiquidityTransaction(payload);

      await updateWalletData();
      return result.receipt;
    } else {
      addLog(`Failed to add liquidity: Transaction failed or rejected`, "error");
      return null;
    }
  } catch (error) {
    addLog(`Failed to add liquidity: ${error.message}`, "error");
    throw error;
  }
}

function showTokenSelectionForLiquidity() {
  const container = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "40%",
    height: "40%",
    border: { type: "line" },
    style: { border: { fg: "blue" } },
    label: " Select Token for Add Liquidity "
  });

  const tokenList = blessed.list({
    parent: container,
    top: 1,
    left: 1,
    width: "80%",
    height: "60%",
    border: { type: "line" },
    style: { border: { fg: "green" }, selected: { bg: "green" } },
    items: tokensForLiquidity.map(token => token.name),
    keys: true,
    mouse: true,
    vi: true
  });

  const cancelButton = blessed.button({
    parent: container,
    content: " Cancel ",
    bottom: 1,
    left: "center",
    shrink: true,
    padding: { left: 1, right: 1 },
    style: { fg: "white", bg: "red", hover: { bg: "blue" } },
    mouse: true,
    keys: true
  });

  tokenList.on("select", (item) => {
    const selectedTokenName = item.getText();
    const selectedToken = tokensForLiquidity.find(token => token.name === selectedTokenName);
    if (selectedToken) {
      promptForLiquidityAmount(selectedToken);
    }
    screen.remove(container);
    safeRender();
  });

  cancelButton.on("press", () => {
    screen.remove(container);
    addLiquiditySubMenu.show();
    addLiquiditySubMenu.focus();
    safeRender();
  });

  container.key(["escape", "q"], () => {
    screen.remove(container);
    addLiquiditySubMenu.show();
    addLiquiditySubMenu.focus();
    safeRender();
  });

  tokenList.focus();
  safeRender();
}

function promptForLiquidityAmount(token) {
  promptBox.setFront();
  promptBox.readInput(`Enter amount of ${token.name} for add liquidity`, "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("Add Liquidity: Invalid input or cancelled.", "warning");
      addLiquiditySubMenu.show();
      addLiquiditySubMenu.focus();
      safeRender();
      return;
    }

    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      addLog("Add Liquidity: Amount must be a positive number.", "warning");
      addLiquiditySubMenu.show();
      addLiquiditySubMenu.focus();
      safeRender();
      return;
    }

    addLog(`Add Liquidity: Starting addition of ${amount} ${token.name} to liquidity pool.`, "system");
    await addLiquidity(token.address, amount)
      .then(() => {
        addLiquiditySubMenu.show();
        addLiquiditySubMenu.focus();
        safeRender();
      })
      .catch(() => {
        addLiquiditySubMenu.show();
        addLiquiditySubMenu.focus();
        safeRender();
      });
  });
}

function getMainMenuItems() {
  let items = [];
  if (heraFISwapRunning || autoClaimRunning) items.push("Stop All Transactions");
  items = items.concat(["HeraFI Swap", "Auto Claim Faucet", "Add Liquidity", "Transaction Queue", "Clear Transaction Logs", "Refresh", "Exit"]);
  return items;
}

function stopAllTransactions() {
  if (heraFISwapRunning || autoClaimRunning) {
    heraFISwapCancelled = true;
    autoClaimCancelled = true;
    addLog("Stop All Transactions: All transactions will be stopped.", "system");
  }
}

mainMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "HeraFI Swap") {
    heraFISwapSubMenu.show();
    heraFISwapSubMenu.focus();
    safeRender();
  } else if (selected === "Auto Claim Faucet") {
    autoClaimSubMenu.show();
    autoClaimSubMenu.focus();
    safeRender();
  } else if (selected === "Add Liquidity") {
    addLiquiditySubMenu.show();
    addLiquiditySubMenu.focus();
    safeRender();
  } else if (selected === "Transaction Queue") {
    showTransactionQueueMenu();
  } else if (selected === "Stop All Transactions") {
    stopAllTransactions();
    mainMenu.setItems(getMainMenuItems());
    mainMenu.focus();
    safeRender();
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Refresh") {
    updateWalletData();
    safeRender();
    addLog("Refreshed", "system");
  } else if (selected === "Exit") {
    process.exit(0);
  }
});

heraFISwapSubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Swap WETH & DEFI") {
    if (heraFISwapRunning) {
      addLog("HeraFI Swap transaction is already running. Stop the transaction first.", "warning");
    } else {
      runAutoSwapWETHDEFI();
    }
  } else if (selected === "Auto Swap SUSHI & DEFI") {
    if (heraFISwapRunning) {
      addLog("HeraFI Swap transaction is already running. Stop the transaction first.", "warning");
    } else {
      runAutoSwapSUSHIDEFI();
    }
  } else if (selected === "Auto Swap CRV & DEFI") {
    if (heraFISwapRunning) {
      addLog("HeraFI Swap transaction is already running. Stop the transaction first.", "warning");
    } else {
      runAutoSwapCRVDEFI();
    }
  } else if (selected === "Auto Swap UNI & DEFI") {
    if (heraFISwapRunning) {
      addLog("HeraFI Swap transaction is already running. Stop the transaction first.", "warning");
    } else {
      runAutoSwapUNIDEFI();
    }
  } else if (selected === "Auto Swap USDC & DEFI") {
    if (heraFISwapRunning) {
      addLog("HeraFI Swap transaction is already running. Stop the transaction first.", "warning");
    } else {
      runAutoSwapUSDCDEFI();
    }
  } else if (selected === "Stop Transaction") {
    if (heraFISwapRunning) {
      heraFISwapCancelled = true;
      addLog("HeraFI Swap: Stop Transaction command received.", "herafi");
    } else {
      addLog("HeraFI Swap: No transaction is running.", "herafi");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    heraFISwapSubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    safeRender();
  } else if (selected === "Refresh") {
    updateWalletData();
    safeRender();
    addLog("Refreshed", "system");
  }
});

autoClaimSubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Claim Faucet All Token") {
    if (autoClaimRunning) {
      addLog("Auto Claim Faucet transaction is already running. Stop the transaction first.", "warning");
    } else {
      runAutoClaimFaucet();
    }
  } else if (selected === "Stop Transaction") {
    if (autoClaimRunning) {
      autoClaimCancelled = true;
      addLog("Auto Claim Faucet: Stop Transaction command received.", "faucet");
    } else {
      addLog("Auto Claim Faucet: No transaction is running.", "faucet");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    autoClaimSubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    safeRender();
  } else if (selected === "Refresh") {
    updateWalletData();
    safeRender();
    addLog("Refreshed", "system");
  }
});

addLiquiditySubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Add Liquidity Token") {
    showTokenSelectionForLiquidity();
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    addLiquiditySubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    safeRender();
  } else if (selected === "Refresh") {
    updateWalletData();
    safeRender();
    addLog("Refreshed", "system");
  }
});

screen.key(["escape", "q", "C-c"], () => process.exit(0));
screen.key(["C-up"], () => { logsBox.scroll(-1); safeRender(); });
screen.key(["C-down"], () => { logsBox.scroll(1); safeRender(); });

safeRender();
mainMenu.focus();
addLog("Dont Forget To Subscribe YT And Telegram @ADB NODE!!", "system");
updateWalletData();
