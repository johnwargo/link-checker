#!/usr/bin/env node

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
// That got me started, then I pulled in more code from the docs and wrote my own

import boxen from 'boxen';
import chalk from 'chalk';
import { execa } from 'execa';
import fs from 'fs';
import { LinkChecker } from "linkinator";
import path from 'path';
import prompts, { PromptObject } from 'prompts';
// https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
import { fileURLToPath } from 'url';

type ConfigObject = {
  siteUrl: string;
  concurrentRequests: number;
  internalLinksOnly: boolean;
  timeoutValue: number;
  outputOptions: LinkState[];
  saveToFile: boolean;
  outputFile?: string;
  outputType?: OutputFormat;
};

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

// *****************************************
// Constants
// *****************************************

const checker = new LinkChecker();
const APP_NAME = 'Link Checker';
const APP_AUTHOR = 'by John M. Wargo (https://johnwargo.com)';
const CONFIG_FILE_NAME = 'link-checker-config.json';
const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_CONCURRENT_REQUESTS = 10;
const DEFAULT_OUTPUT_FILE_ROOT = 'link-checker-results';
const DEFAULT_TIMEOUT = 5000;

const defaultConfigObject: ConfigObject = {
  siteUrl: DEFAULT_URL,
  concurrentRequests: DEFAULT_CONCURRENT_REQUESTS,
  internalLinksOnly: true,
  timeoutValue: DEFAULT_TIMEOUT,
  outputOptions: [LinkState.BROKEN],
  saveToFile: true,
  outputFile: 'link-checker-results',
  outputType: OutputFormat.JSON
};

const OutputMap = {
  OK: chalk.green("OK"),
  BROKEN: chalk.red("BROKEN"),
  SKIPPED: chalk.yellow("SKIPPED"),
};

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
    type: 'confirm',
    name: 'internalLinksOnly',
    message: 'Test internal links only? (No for internal and external links)',
    initial: true
  }, {
    type: 'number',
    name: 'concurrentRequests',
    message: 'Number of concurrent requests; must be greater than zero',
    initial: DEFAULT_CONCURRENT_REQUESTS
  }, {
    type: 'number',
    name: 'timeoutValue',
    message: 'Timeout value (in milliseconds); must be greater than zero',
    initial: DEFAULT_TIMEOUT
  }, {
    type: 'multiselect',
    name: 'outputOptions',
    message: 'Select output options',
    choices: [
      { title: 'OK', value: LinkState.OK, selected: false },
      { title: 'Broken', value: LinkState.BROKEN, selected: true },
      { title: 'Skipped', value: LinkState.SKIPPED, selected: false }
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
    // v0.0.8 show parent URL
    var parentUrl = res.parent ? ` (Source: ${res.parent})` : '';
    console.log(`${OutputMap[res.state]} (${statusStr}): ${res.url}${parentUrl}`);
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

function displayHelpAndExit(targetFolder: string) {
  // Read the file and print its content to the console
  const filePath = path.join(targetFolder, 'help.txt');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    console.log(data);
  } catch (err) {
    console.error('Unable to display help content, error reading help file');
    console.error(err);
  }
  process.exit(0);
}

function writeFileSection(outputFormat: OutputFormat, sectionHeader: string, section: LinkState, siteUrlLength: number): string {
  var sectionText: string = '';

  // get the links array for the section
  var linksArray = result.links.filter(x => x.state === section);
  // do we have any results?  No? then return an empty string
  if (linksArray.length < 1) return '';

  // sort the array
  linksArray = linksArray.sort((a, b) => a.url.localeCompare(b.url));  
  // linksArray = linksArray.sort((a, b) => a.parent.localeCompare(b.parent));

  switch (outputFormat) {
    case OutputFormat.MARKDOWN:
      sectionText = `## ${sectionHeader}\n\n`;
      sectionText += '| Status | URL | Source |\n';
      sectionText += '|--------|-----|--------|\n';
      for (var link of linksArray) {
        //@ts-ignore
        var sourceUrl = link.parent.slice(siteUrlLength);
        sectionText += `| ${link.status?.toString().padStart(3, ' ')} | ${link.url} | ${sourceUrl} |\n`;
      }
      break;
    case OutputFormat.TXT:
      sectionText = sectionHeader + '\n';
      sectionText += '-'.repeat(sectionHeader.length + 5) + '\n';
      for (var link of linksArray) {
        //@ts-ignore
        var sourceUrl = link.parent.slice(siteUrlLength);
        sectionText += `(${link.status?.toString().padStart(3, ' ')}) ${link.url} <-- ${sourceUrl}\n`;
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

// https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// do we have command-line arguments?
const myArgs = process.argv.slice(2);
if (myArgs.includes('-?') || myArgs.includes('/?')) displayHelpAndExit(__dirname);

const debugMode = myArgs.includes('-d');
if (debugMode) console.log(chalk.yellow('Debug Mode enabled'));

const saveConfig = myArgs.includes('-s');
const autoMode = myArgs.includes('-a');

// are both modes enabled?
if (saveConfig && autoMode) {
  // not allowed
  console.log(chalk.red('\nError: -s and -a flags are mutually exclusive'));
  process.exit(1);
}

var config: any = {}
var configAlt: any = {}

if (autoMode) {
  // auto mode, no prompts
  console.log(chalk.yellow('Auto mode enabled'));
  const configFilePath = path.join(process.cwd(), CONFIG_FILE_NAME);
  if (!fs.existsSync(configFilePath)) {
    console.log(chalk.red(`\nError: Configuration file not found: ${configFilePath}`));
    process.exit(1);
  }
  const configFile = fs.readFileSync(configFilePath, 'utf8');
  configAlt = JSON.parse(configFile);
  // copy the read configuration to the config object
  config = { ...defaultConfigObject, ...configAlt };
} else {
  // prompt for the configuration options
  config = await prompts(prompt1, { onCancel: onCancelPrompt });
  // did the user want to save the output to a file?
  if (config.saveToFile) {
    // then do another prompt
    configAlt = await prompts(prompt2, { onCancel: onCancelPrompt });
    config = { ...config, ...configAlt };
  }
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

if (saveConfig) {
  // save the configuration to a file  
  const configFilePath = path.join(process.cwd(), CONFIG_FILE_NAME);
  console.log(chalk.yellow(`\nSaving configuration to ${configFilePath}\n`));
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
  process.exit(0);
}

// Added v0.0.6
let checkerOptions: any = {
  concurrency: config.concurrentRequests,
  path: config.siteUrl,
  recurse: true,
  timeout: config.timeoutValue
};
// Added v0.0.6
if (config.internalLinksOnly) {
  /* linksToSkip (array | function) - An array of regular expression strings that should be skipped, OR an async function that's called for each link with the link URL as its only argument. Return a Promise that resolves to true to skip the link or false to check it. */
  checkerOptions.linksToSkip = (url: string) => {
    // Skip anything that isn't an internal link
    return !url.startsWith(config.siteUrl) && !url.startsWith('/');
  }
}

console.log(chalk.yellow('\nStarting scan...\n'));
const result = await checker.check(checkerOptions);

// get the link counts
const processedLinks = result.links.length;
const scannedLinks = result.links.filter(x => x.state !== 'SKIPPED').length;
const brokenLinks = result.links.filter(x => x.state === 'BROKEN').length;
const skippedLinks = result.links.filter(x => x.state === 'SKIPPED').length;

if (config.saveToFile) {

  const siteUrlLength = config.siteUrl.length;
  
  let saveFile: boolean = config.outputOptions.includes(LinkState.OK) && processedLinks > 0;
  saveFile = saveFile || config.outputOptions.includes(LinkState.BROKEN) && brokenLinks > 0;
  saveFile = saveFile || config.outputOptions.includes(LinkState.SKIPPED) && skippedLinks > 0;

  if (saveFile) {
    var ext = 'UNKNOWN';
    var outputBody = '';

    switch (config.outputType) {
      case OutputFormat.JSON:
        ext = '.json';
        outputBody = JSON.stringify(result, null, 2);
        break;
      case OutputFormat.MARKDOWN:
        ext = '.md';
        outputBody = `# Link Checker Results\n\n**Created:** ${new Date().toLocaleString()}\n**Site:** ${config.siteUrl}\n\n`;
        if (config.outputOptions.includes(LinkState.BROKEN)) outputBody += writeFileSection(OutputFormat.MARKDOWN, 'Broken Links', LinkState.BROKEN, siteUrlLength);
        if (config.outputOptions.includes(LinkState.SKIPPED)) outputBody += writeFileSection(OutputFormat.MARKDOWN, 'Skipped Links', LinkState.SKIPPED, siteUrlLength);
        if (config.outputOptions.includes(LinkState.OK)) outputBody += writeFileSection(OutputFormat.MARKDOWN, 'OK Links', LinkState.OK, siteUrlLength);
        outputBody += '---\n\nReport created by <a href="https://github.com/johnwargo/link-checker" target="_blank">Link Checker</a> by John M. Wargo.\n';
        break;
      case OutputFormat.TXT:
        ext = '.txt';
        outputBody = `Link Checker Results\n${'='.repeat(20)}\n\nCreated: ${new Date().toLocaleString()}\nSite: ${config.siteUrl}\n\n`;
        if (config.outputOptions.includes(LinkState.BROKEN)) outputBody += writeFileSection(OutputFormat.TXT, 'Broken Links', LinkState.BROKEN, siteUrlLength);
        if (config.outputOptions.includes(LinkState.SKIPPED)) outputBody += writeFileSection(OutputFormat.TXT, 'Skipped Links', LinkState.SKIPPED, siteUrlLength);
        if (config.outputOptions.includes(LinkState.OK)) outputBody += writeFileSection(OutputFormat.TXT, 'OK Links', LinkState.OK, siteUrlLength);
        outputBody += '---\n\nReport created by Link Checker (https://github.com/johnwargo/link-checker) by John M. Wargo.\n';
        break;
    }

    const filePath = path.join(process.cwd(), config.outputFile + ext);
    if (debugMode) console.log(chalk.blue('Writing output to file...'));
    try {
      fs.writeFileSync(filePath, outputBody);
      console.log(chalk.green('\nResults successfully written to file: ') + filePath);
    } catch (err) {
      console.log(chalk.red('\nError writing output to file'));
      console.dir(err);
    }

    if (process.env.TERM_PROGRAM == "vscode") {
      // are we running in Visual Studio Code? Open the file in the editor
      console.log(chalk.yellow('\nOpening report in Visual Studio Code'));
      try {
        await execa('code', [filePath]);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
  } else {
    console.log(chalk.yellow('\nNo results to save to file'));
  }
}

console.log(`\nScan Results`);
console.log('='.repeat(30));
console.log(chalk.green('Found: ') + processedLinks.toLocaleString() + ' links');
console.log(chalk.green('Scanned: ') + scannedLinks.toLocaleString() + ' links');
if (config.outputOptions.includes(LinkState.BROKEN))
  console.log(chalk.red('Broken: ') + brokenLinks.toLocaleString() + ' links');
if (config.outputOptions.includes(LinkState.SKIPPED))
  console.log(chalk.yellow('Skipped: ') + skippedLinks.toLocaleString() + ' links');
console.log('='.repeat(30));

// Have to do this because some requests are still in progress, 
// but never seem to return
process.exit(0);
