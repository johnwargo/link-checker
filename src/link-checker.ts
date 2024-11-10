/******************************************
 * Link Checker
 * 
 * by John M. Wargo 
 * https://johnwargo.com
 * 
*******************************************/

// Based on: https://www.seancdavis.com/posts/using-nodejs-to-check-for-broken-links/
// That got me started, then I pulled in more code from the docs

// TODO: Prompt for output scope

import boxen from 'boxen';
import chalk from 'chalk';
import fs from 'fs';
import { LinkChecker } from "linkinator";
import path from 'path';
import prompts, { PromptObject } from 'prompts';

type LinkResult = {
  url: string;
  status?: number;
  state: LinkState;
  parent?: string;
  failureDetails?: any;
};

enum LinkState {
  OK = 'OK',
  BROKEN = 'BROKEN',
  SKIPPED = 'SKIPPED',
}

const OutputMap = {
  OK: chalk.green("OK"),
  BROKEN: chalk.red("BROKEN"),
  SKIPPED: chalk.yellow("SKIPPED"),
};

enum outputFormat { JSON, MARKDOWN, TXT }
const outputFormats = ['.json', '.md', '.txt'];

enum OutputScope { ALL, OK, BROKEN, SKIPPED }

type RetryInfo = {
  url: string;
  secondsUntilRetry: number;
  status: number;
};

const checker = new LinkChecker();

const APP_NAME = 'Link Checker';
const APP_AUTHOR = 'by John M. Wargo (https://johnwargo.com)';

// *****************************************
// Default Prompt Values
// *****************************************

const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_CONCURRENT_REQUESTS = 100;
const DEFAULT_OUTPUT_FILE_ROOT = 'link-checker-results';
const DEFAULT_TIMEOUT = 10000;

// *****************************************
// Prompt arrays
// *****************************************

const prompt1: PromptObject[] = [
  {
    type: 'text',
    name: 'siteUrl',
    message: 'Target site URL',
    initial: DEFAULT_URL
  }, {
    type: 'number',
    name: 'concurrentRequests',
    message: 'Number of concurrent requests',
    initial: DEFAULT_CONCURRENT_REQUESTS
  }, {
    type: 'number',
    name: 'timeoutValue',
    message: 'Timeout value (in milliseconds)',
    initial: DEFAULT_TIMEOUT
  }, {
    type: 'confirm',
    name: 'saveToFile',
    message: 'Save output to file?',
    initial: true
  }
];

const prompt2: PromptObject[] = [
  {
    type: 'select',
    name: 'outputType',
    message: 'Output format',
    initial: 1,
    choices: [
      { title: 'JSON (.json)', value: outputFormat.JSON },
      { title: 'Markdown (.md)', value: outputFormat.MARKDOWN },
      { title: 'Text (.txt)', value: outputFormat.TXT },
    ]
  }, {
    type: 'text',
    name: 'outputFile',
    message: 'Output file root filename (no extension)',
    initial: DEFAULT_OUTPUT_FILE_ROOT,
  }
];

/* Event Handlers */

checker.on('pagestart', (url: string) => {
  console.log(chalk.yellow('Scanning') + `: ${url}`);
});

checker.on('link', (res: LinkResult) => {
  console.log(`${OutputMap[res.state]} (${res.status}): ${res.url}`);
});

checker.on('retry', (details: RetryInfo) => {
  var resStr: string = chalk.yellow('Retrying:');
  resStr += ` ${details.url} (${details.status}) in ${details.secondsUntilRetry} seconds`;
  console.log(resStr);
});

const onCancelPrompt = () => {
  console.log(chalk.red('\nOperation cancelled by user!'));
  process.exit(0);
};

/* Functions */

function isValidHttpUrl(urlStr: string): boolean {
  try {
    const theUrl = new URL(urlStr);
    return theUrl.protocol === 'http:' || theUrl.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function logConfigError(errStr: string) {
  console.log(`\n${chalk.red('Error:')} ${errStr}`);
  process.exit(1);
}

/* Main Program  (execution starts here) */

console.log(boxen(APP_NAME, { padding: 1 }));
console.log(`\n${APP_AUTHOR}\n`);

// do we have command-line arguments?
const myArgs = process.argv.slice(2);
const debugMode = myArgs.includes('-d');
if (debugMode) console.log(chalk.yellow('Debug Mode enabled\n'));

// prompt for the configuration options
var config = await prompts(prompt1, { onCancel: onCancelPrompt });
// did the user want to save the output to a file?
if (config.saveToFile) {
  // then do another prompt
  const configAlt = await prompts(prompt2, { onCancel: onCancelPrompt });
  config = { ...config, ...configAlt };
}
if (debugMode) {
  console.log(chalk.yellow('\nConfiguration Object:'));
  console.dir(config);
}

// validate the configuration
// do we have a valid URL?
if (!isValidHttpUrl(config.siteUrl)) logConfigError(`${config.siteUrl} is not a valid URL`);
// do we have a valid number of concurrent requests?
if (config.concurrentRequests < 1) logConfigError('Concurrent requests must be greater than 0');
// do we have a valid timeout value?
if (config.timeoutValue < 1) logConfigError('Timeout value must be greater than 0');

console.log(chalk.yellow('\nStarting scan...\n'));
const result = await checker.check({
  concurrency: config.concurrentRequests,
  path: config.siteUrl,
  recurse: true,
  timeout: config.timeoutValue
});

// write the output to the file
if (config.saveToFile) {

  // first build the output file path
  var ext = 'UNKNOWN';
  var outputBody = '';

  switch (config.outputType) {
    case outputFormat.JSON:
      ext = '.json';
      outputBody = JSON.stringify(result, null, 2);
      break;
    case outputFormat.MARKDOWN:
      ext = '.md';
      outputBody = '# Link Checker Results\n\n';
      break;
    case outputFormat.TXT:
      ext = '.txt';
      outputBody = 'Link Checker Results\n\n';
      break;
  }
  const filePath = path.join(process.cwd(), config.outputFile + ext);
  if (debugMode) console.log(`\n${chalk.yellow('Output file path:')} ${filePath}`);
  console.log();

  if (debugMode) console.log(chalk.yellow('Writing output to file...'));
  try {
    fs.writeFileSync(filePath, outputBody);
    console.log(chalk.green('File written successfully: ') + filePath);
  } catch (err) {
    console.log(chalk.red('Error writing output to file'));
    console.dir(err);
  }
}

const brokenLinksCount = result.links.filter(x => x.state === 'BROKEN');
const skippedLinksCount = result.links.filter(x => x.state === 'SKIPPED');
console.log();
console.log(result.passed ? chalk.green('Scan complete') : chalk.red('Scan Failed '));
console.log(`Scanned ${result.links.length.toLocaleString()} links`);
console.log(`Found ${brokenLinksCount.length.toLocaleString()} broken links`);
console.log(`Skipped ${skippedLinksCount.length.toLocaleString()} links`);
