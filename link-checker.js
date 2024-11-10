import boxen from 'boxen';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { LinkChecker } from "linkinator";
import prompts from 'prompts';
var LinkState;
(function (LinkState) {
    LinkState["OK"] = "OK";
    LinkState["BROKEN"] = "BROKEN";
    LinkState["SKIPPED"] = "SKIPPED";
})(LinkState || (LinkState = {}));
const OutputMap = {
    OK: chalk.green("OK"),
    BROKEN: chalk.red("BROKEN"),
    SKIPPED: chalk.yellow("SKIPPED"),
};
var OutputScope;
(function (OutputScope) {
    OutputScope[OutputScope["ALL"] = 0] = "ALL";
    OutputScope[OutputScope["OK"] = 1] = "OK";
    OutputScope[OutputScope["BROKEN"] = 2] = "BROKEN";
    OutputScope[OutputScope["SKIPPED"] = 3] = "SKIPPED";
})(OutputScope || (OutputScope = {}));
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
        type: 'confirm',
        name: 'saveToFile',
        message: 'Save output to file?',
        initial: true
    }
];
const prompt2 = [
    {
        type: 'select',
        name: 'outputExtension',
        message: 'Output format',
        initial: 0,
        choices: [
            { title: 'Markdown (.md)', value: '.md' },
            { title: 'JSON (.json)', value: '.json' }
        ]
    }, {
        type: 'text',
        name: 'outputFile',
        message: 'Output file root filename (no extension)',
        initial: DEFAULT_OUTPUT_FILE_ROOT,
    }
];
checker.on('pagestart', (url) => {
    console.log(chalk.yellow('Scanning') + `: ${url}`);
});
checker.on('link', (res) => {
    console.log(`${OutputMap[res.state]} (${res.status}): ${res.url}`);
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
const filePath = path.join(process.cwd(), config.outputFile + config.outputExtension);
if (debugMode)
    console.log(`\n${chalk.yellow('Output file path:')} ${filePath}`);
console.log(chalk.yellow('\nStarting scan...\n'));
const result = await checker.check({
    concurrency: config.concurrentRequests,
    path: config.siteUrl,
    recurse: true,
    timeout: config.timeoutValue
});
if (config.saveToFile) {
    console.log();
    if (debugMode)
        console.log(chalk.yellow('Writing output to file...'));
    try {
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
        console.log(chalk.green('File written successfully: ') + filePath);
    }
    catch (err) {
        console.log(chalk.red('Error writing output to file'));
        console.dir(err);
    }
}
console.log();
console.log(result.passed ? chalk.green('Scan complete') : chalk.red('Scan Failed '));
console.log(`Scanned ${result.links.length.toLocaleString()} links`);
const brokeLinksCount = result.links.filter(x => x.state === 'BROKEN');
console.log(`Detected ${brokeLinksCount.length.toLocaleString()} broken links.`);