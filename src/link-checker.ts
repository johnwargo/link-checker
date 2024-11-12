/********************************************
 * Link Checker
 * 
 * by John M. Wargo 
 * https://johnwargo.com
 * 
 * Created November, 2024
 * 
 * https://github.com/johnwargo/link-checker
 * 
*********************************************/

// Based on: https://www.seancdavis.com/posts/using-nodejs-to-check-for-broken-links/
// That got me started, then I pulled in more code from the docs

// TODO: Local only flag (don't check external links)

import boxen from 'boxen';
import chalk from 'chalk';
import { execa } from 'execa';
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

type RetryInfo = {
  url: string;
  secondsUntilRetry: number;
  status: number;
};

enum LinkState {
  BROKEN = 'BROKEN',
  SKIPPED = 'SKIPPED',
  OK = 'OK',
}

enum OutputFormat { JSON, MARKDOWN, TXT }

const OutputMap = {
  OK: chalk.green("OK"),
  BROKEN: chalk.red("BROKEN"),
  SKIPPED: chalk.yellow("SKIPPED"),
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
    type: 'multiselect',
    name: 'outputOptions',
    message: 'Select output options',
    choices: [
      { title: 'OK', value: LinkState.OK, selected: false },
      { title: 'Broken', value: LinkState.BROKEN, selected: true },
      { title: 'Skipped', value: LinkState.SKIPPED, selected: true }
    ],
    // max: 2,
    hint: '- Space to select. Return to submit'
  }, {
    type: 'confirm',
    name: 'saveToFile',
    message: 'Save output to file?',
    initial: true
  }
];

const prompt2: PromptObject[] = [
  {
    type: 'text',
    name: 'outputFile',
    message: 'Output file root filename (no extension)',
    initial: DEFAULT_OUTPUT_FILE_ROOT,
  }, {
    type: 'select',
    name: 'outputType',
    message: 'Output format',
    initial: 1,
    choices: [
      { title: 'JSON (.json)', value: OutputFormat.JSON },
      { title: 'Markdown (.md)', value: OutputFormat.MARKDOWN },
      { title: 'Text (.txt)', value: OutputFormat.TXT },
    ]
  }
];

// *****************************************
// Event Handlers
// *****************************************

checker.on('pagestart', (url: string) => {
  console.log(`${chalk.blue('Scanning')}: ${url}`);
});

checker.on('link', (res: LinkResult) => {

  function logLinkDetails(res: LinkResult) {
    var statusStr = res.status?.toString().padStart(3, ' ');
    console.log(`${OutputMap[res.state]} (${statusStr}): ${res.url}`);
  }

  switch (res.state) {
    case LinkState.BROKEN:
      if (config.outputOptions.includes(LinkState.BROKEN)) logLinkDetails(res);
      break;
    case LinkState.SKIPPED:
      if (config.outputOptions.includes(LinkState.SKIPPED)) logLinkDetails(res);
      break;
    case LinkState.OK:
      if (config.outputOptions.includes(LinkState.OK)) logLinkDetails(res);
      break;
  }
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

// *****************************************
// Functions
// *****************************************

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

function displayHelpAndExit() {
  // Read the file and print its content to the console
  const filePath = path.join(__dirname, 'help.txt');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    console.log(data);
  } catch (err) {
    console.error('Unable to display help content, error reading help file');
    console.error(err);
  }
  process.exit(0);
}

function writeFileSection(outputFormat: OutputFormat, sectionHeader: string, section: LinkState): string {
  var sectionText: string = '';

  // get the links array for the section
  var linksArray = result.links.filter(x => x.state === section);
  // do we have any results?  No? then return an empty string
  if (linksArray.length < 1) return '';

  // sort the array
  linksArray = linksArray.sort((a, b) => a.url.localeCompare(b.url));

  switch (outputFormat) {
    case OutputFormat.MARKDOWN:
      sectionText = `## ${sectionHeader}\n\n`;
      sectionText += '| Status | URL |\n';
      sectionText += '|--------|-----|\n';
      for (var link of linksArray) {
        sectionText += `| ${link.status?.toString().padStart(3, ' ')} | ${link.url} |\n`;
      }
      break;
    case OutputFormat.TXT:
      sectionText = sectionHeader + '\n';
      sectionText += '-'.repeat(sectionHeader.length + 5) + '\n';
      for (var link of linksArray) {
        sectionText += `(${link.status?.toString().padStart(3, ' ')}) ${link.url}\n`;
      }
      break;
  }
  sectionText += '\n';
  return sectionText;
}

// *****************************************
/*  Main Program  (execution starts here) */
// *****************************************

console.log(boxen(APP_NAME, { padding: 1 }));
console.log(`\n${APP_AUTHOR}\n`);

// do we have command-line arguments?
const myArgs = process.argv.slice(2);
if (myArgs.includes('-?')) displayHelpAndExit();

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
if (!isValidHttpUrl(config.siteUrl)) logConfigError(`${config.siteUrl} is not a valid URL`);
if (config.concurrentRequests < 1) logConfigError('Concurrent requests must be greater than 0');
if (config.timeoutValue < 1) logConfigError('Timeout value must be greater than 0');
if (config.outputOptions.length < 1) logConfigError('You must select at least one output option');

console.log(chalk.yellow('\nStarting scan...\n'));
const result = await checker.check({
  concurrency: config.concurrentRequests,
  path: config.siteUrl,
  recurse: true,
  timeout: config.timeoutValue
});

if (config.saveToFile) {
  var ext = 'UNKNOWN';
  var outputBody = '';

  switch (config.outputType) {
    case OutputFormat.JSON:
      ext = '.json';
      outputBody = JSON.stringify(result, null, 2);
      break;
    case OutputFormat.MARKDOWN:
      ext = '.md';
      outputBody = `# Link Checker Results\n\n**Created:** ${new Date().toLocaleString()}\n\n`;
      if (config.outputOptions.includes(LinkState.BROKEN)) outputBody += writeFileSection(OutputFormat.MARKDOWN, 'Broken Links', LinkState.BROKEN);
      if (config.outputOptions.includes(LinkState.SKIPPED)) outputBody += writeFileSection(OutputFormat.MARKDOWN, 'Skipped Links', LinkState.SKIPPED);
      if (config.outputOptions.includes(LinkState.OK)) outputBody += writeFileSection(OutputFormat.MARKDOWN, 'OK Links', LinkState.OK);
      outputBody += '---\n\nReport created by <a href="https://github.com/johnwargo/link-checker" target="_blank">Link Checker</a> by John M. Wargo.\n';
      break;
    case OutputFormat.TXT:
      ext = '.txt';
      outputBody = `Link Checker Results\n${'='.repeat(20)}\n\nCreated: ${new Date().toLocaleString()}\n\n`;
      if (config.outputOptions.includes(LinkState.BROKEN)) outputBody += writeFileSection(OutputFormat.TXT, 'Broken Links', LinkState.BROKEN);
      if (config.outputOptions.includes(LinkState.SKIPPED)) outputBody += writeFileSection(OutputFormat.TXT, 'Skipped Links', LinkState.SKIPPED);
      if (config.outputOptions.includes(LinkState.OK)) outputBody += writeFileSection(OutputFormat.TXT, 'OK Links', LinkState.OK);
      outputBody += '---\n\nReport created by Link Checker (https://github.com/johnwargo/link-checker) by John M. Wargo.\n';
      break;
  }

  const filePath = path.join(process.cwd(), config.outputFile + ext);
  if (debugMode) console.log(chalk.blue('Writing output to file...'));
  try {
    fs.writeFileSync(filePath, outputBody);
    console.log(chalk.green('Results successfully written to file: ') + filePath);
  } catch (err) {
    console.log(chalk.red('Error writing output to file'));
    console.dir(err);
  }
  
  if (process.env.TERM_PROGRAM == "vscode") {
    // are we running in Visual Studio Code? Open the file in the editor
    console.log(chalk.blue('Opening report in Visual Studio Code'));
    try {
      await execa('code', [filePath]);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }
}

console.log(`\nScan Results`);
console.log('='.repeat(30));
console.log(chalk.green('Scanned: ') + result.links.length.toLocaleString() + ' links');

if (config.outputOptions.includes(LinkState.BROKEN)) {
  const brokenLinksCount = result.links.filter(x => x.state === 'BROKEN');
  console.log(chalk.red('Broken: ') + brokenLinksCount.length.toLocaleString() + ' links');
}
  
if (config.outputOptions.includes(LinkState.SKIPPED)){
  const skippedLinksCount = result.links.filter(x => x.state === 'SKIPPED');
  console.log(chalk.yellow('Skipped: ') + skippedLinksCount.length.toLocaleString() + ' links');
}

console.log('='.repeat(30));

// Have to do this because some requests are still in progress, 
// but never seem to return
process.exit(0);