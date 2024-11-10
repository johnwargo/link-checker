import boxen from 'boxen';
import chalk from 'chalk';
import fs from 'fs';
import { LinkChecker } from "linkinator";
import path from 'path';
import prompts from 'prompts';
var LinkState;
(function (LinkState) {
    LinkState["BROKEN"] = "BROKEN";
    LinkState["SKIPPED"] = "SKIPPED";
    LinkState["OK"] = "OK";
})(LinkState || (LinkState = {}));
var outputFormat;
(function (outputFormat) {
    outputFormat[outputFormat["JSON"] = 0] = "JSON";
    outputFormat[outputFormat["MARKDOWN"] = 1] = "MARKDOWN";
    outputFormat[outputFormat["TXT"] = 2] = "TXT";
})(outputFormat || (outputFormat = {}));
const OutputMap = {
    OK: chalk.green("OK"),
    BROKEN: chalk.red("BROKEN"),
    SKIPPED: chalk.yellow("SKIPPED"),
};
const checker = new LinkChecker();
const APP_NAME = 'Link Checker';
const APP_AUTHOR = 'by John M. Wargo (https://johnwargo.com)';
const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_CONCURRENT_REQUESTS = 100;
const DEFAULT_OUTPUT_FILE_ROOT = 'link-checker-results';
const DEFAULT_TIMEOUT = 10000;
const prompt1 = [
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
        hint: '- Space to select. Return to submit'
    }, {
        type: 'confirm',
        name: 'saveToFile',
        message: 'Save output to file?',
        initial: true
    }
];
const prompt2 = [
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
checker.on('pagestart', (url) => {
    console.log(`${chalk.blue('Scanning')}: ${url}`);
});
checker.on('link', (res) => {
    function logLinkDetails(res) {
        var statusStr = res.status?.toString().padStart(3, ' ');
        console.log(`${OutputMap[res.state]} (${statusStr}): ${res.url}`);
    }
    switch (res.state) {
        case LinkState.BROKEN:
            if (config.outputOptions.includes(LinkState.BROKEN))
                logLinkDetails(res);
            break;
        case LinkState.SKIPPED:
            if (config.outputOptions.includes(LinkState.SKIPPED))
                logLinkDetails(res);
            break;
        case LinkState.OK:
            if (config.outputOptions.includes(LinkState.OK))
                logLinkDetails(res);
            break;
    }
});
checker.on('retry', (details) => {
    var resStr = chalk.yellow('Retrying:');
    resStr += ` ${details.url} (${details.status}) in ${details.secondsUntilRetry} seconds`;
    console.log(resStr);
});
const onCancelPrompt = () => {
    console.log(chalk.red('\nOperation cancelled by user!'));
    process.exit(0);
};
function isValidHttpUrl(urlStr) {
    try {
        const theUrl = new URL(urlStr);
        return theUrl.protocol === 'http:' || theUrl.protocol === 'https:';
    }
    catch (err) {
        return false;
    }
}
function logConfigError(errStr) {
    console.log(`\n${chalk.red('Error:')} ${errStr}`);
    process.exit(1);
}
console.log(boxen(APP_NAME, { padding: 1 }));
console.log(`\n${APP_AUTHOR}\n`);
const myArgs = process.argv.slice(2);
const debugMode = myArgs.includes('-d');
if (debugMode)
    console.log(chalk.yellow('Debug Mode enabled\n'));
var config = await prompts(prompt1, { onCancel: onCancelPrompt });
if (config.saveToFile) {
    const configAlt = await prompts(prompt2, { onCancel: onCancelPrompt });
    config = { ...config, ...configAlt };
}
if (debugMode) {
    console.log(chalk.yellow('\nConfiguration Object:'));
    console.dir(config);
}
if (!isValidHttpUrl(config.siteUrl))
    logConfigError(`${config.siteUrl} is not a valid URL`);
if (config.concurrentRequests < 1)
    logConfigError('Concurrent requests must be greater than 0');
if (config.timeoutValue < 1)
    logConfigError('Timeout value must be greater than 0');
if (config.outputOptions.length < 1)
    logConfigError('You must select at least one output option');
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
    if (debugMode)
        console.log(`\n${chalk.yellow('Output file path:')} ${filePath}`);
    if (debugMode)
        console.log('Writing output to file...');
    try {
        fs.writeFileSync(filePath, outputBody);
        console.log(chalk.green('Results successfully written to file: ') + filePath);
    }
    catch (err) {
        console.log(chalk.red('Error writing output to file'));
        console.dir(err);
    }
}
console.log(`\nScan Results`);
console.log('='.repeat(30));
console.log(chalk.green('Scanned: ') + result.links.length.toLocaleString() + ' links');
const brokenLinksCount = result.links.filter(x => x.state === 'BROKEN');
if (config.outputOptions.includes(LinkState.BROKEN))
    console.log(chalk.red('Broken: ') + brokenLinksCount.length.toLocaleString() + ' links');
const skippedLinksCount = result.links.filter(x => x.state === 'SKIPPED');
if (config.outputOptions.includes(LinkState.SKIPPED))
    console.log(chalk.yellow('Skipped: ') + skippedLinksCount.length.toLocaleString() + ' links');
process.exit(0);
