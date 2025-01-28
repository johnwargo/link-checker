A simple node.js-based terminal (command-line) utility that validates links on a local or remote web site. You provide the target URL and answer a couple of questions and the utility scans all links on the target site (recursively) and reports the results to the console. You can even write the results to a file in json, markdown and text format for further analysis.

<!-- TOC -->

- [Features](#features)
- [Installation](#installation)
  - [Global Installation](#global-installation)
  - [Project Installation](#project-installation)
- [Executing Without Installation](#executing-without-installation)
- [Operation](#operation)
  - [Default Operation](#default-operation)
  - [Automated Operation](#automated-operation)
- [Status Codes](#status-codes)
- [False Positives](#false-positives)
- [Command-line Arguments](#command-line-arguments)
- [Background](#background)

<!-- /TOC -->
## Features

+ This utility doesn't require a bunch of command-line options (it only supports two limited ones), instead it prompts you for all of the settings it needs to do its work. So it's command-line initiated but prompt driven.
+ You can easily filter results to show good (OK), bad (Broken), and Skipped URLs.
+ You can save the filtered results to a report file in three different formats: JSON, Markdown, and Text formats.

## Installation

The utility installs a command called `checklinks`, accessible within your environment depending on how you install it.

### Global Installation

``` shell
npm install -g @johnwargo/link-checker
```

With that in place, you can execute the utility from a terminal window anywhere on the system using:

``` shell
checklinks
```

### Project Installation

To install the utility as a development dependency in a node.js-based project, in a terminal window pointing to the project folder execute the following command:

```shell
npm install --save-dev @johnwargo/link-checker
```

Then, add a command to the scripts section of the project's `package.json` file:

```json
"scripts": {
  "linkcheck": "checklinks",   
},
```

To check links from the project folder, simply execute the following command in a terminal window:

```shell
npm run linkcheck
```

## Executing Without Installation

To execute the utility without installing it on your system, simply open a terminal window and execute the following command:

``` shell
npx @johnwargo/link-checker
```

With this approach, npm downloads and execute the utility without installing it.

## Operation

### Default Operation

When you execute the utility, it prompts you for its operating parameters:

 It looks like this:

```text
┌──────────────────┐
│                  │
│   Link Checker   │
│                  │
└──────────────────┘

by John M. Wargo (https://johnwargo.com)

? Target site URL » http://localhost:8080
```

The following table lists the available configuration options (and associated prompts) used by the utility.

| Option                        | Description |
| ----------------------------- | ----------- |
| Target Site URL               | The target URL you want scanned for links; the utility will start there and work through all of the links on the page. <br />Default: http://localhost:8080 |
| Test internal links only | Skips all external links, any link that doesn't start with the *Target Site URL*  or `/` |
| Number of Concurrent Requests | Specifies the number of simultaneous requests the server will send while validating links. The utility can spawn multiple requests while validating links, which creates issues for you if the target server has code in place to block rapid repeated access (like in a [DDOS](https://en.wikipedia.org/wiki/Denial-of-service_attack) or other attack). If the web application you're scanning runs locally or on a server that you know doesn't block or delay repeated requests, then use a value of 100 or more if you want. For public servers and/or sites you don't own, use the default value of 10 or less.<br />Default: 10 |
| Timeout Value                 | Number of milliseconds the utility waits on an unresponsive site before failing. Values between 5000 (5 seconds) and 10000 (10 seconds) should be sufficient, but you may want to increase this due to slower servers.<br />Default: 5000 |
| Output Options                | The URL validation library used internally by the utility categorizes validated links in three ways: OK (HTTP status code 200), Broken (any other status code), and Skipped (for non HTTP links such as `tel` or `mailto`). This is a multiple choice selection that defaults to **Broken**. You can toggle any of the three options to control the program's output to the console and results file.<br />**Skipped** links aren't that interesting as the option only lists links that the validation library ignores by default. If you enable **OK**, you'll see the list of all links validated good (OK - status code 200) by the utility.<br />Default: Broken |
| Save to File                  | A **Yes**/**No** prompt asking you whether you want scan results written to an external file. If the site you're scanning has a lot of links (more than 100, for example), you should use this option rather than scanning the terminal window for links after they've scrolled by.<br />If you run the utility in a Visual Studio Code terminal, the terminal window truncates, so you may lose link results for larger sites.<br />Default: Y |
| Output Root File Name         | Available only when Save to File is selected (Yes selected).<br />The root file name used for the saved results file. Do not provide a file extension for the output file since that's set automatically based on the selection made in **Output Format** below.<br />Default: `link-checker-results` |
| Output Format                 | Available only when Save to File is selected (Yes selected). Controls the output format for the scan results written to a file. Supported options are: JSON (.json), Markdown (.md), and Text (.txt).<br />Default: Markdown (.md) |

**Note:** If you save the results to file and executed the utility in a terminal window in Visual Studio Code, the utility will automatically open the results file in the editor before displaying the final results in the terminal window.

**Note:** Press the keyboard's Escape button to cancel the utility's prompting so you can start over.

Here's an example of the complete utility output: 

``` text
┌──────────────────┐
│                  │
│   Link Checker   │
│                  │
└──────────────────┘

by John M. Wargo (https://johnwargo.com)

√ Target site URL ... http://localhost:8080
√ Test internal links only? (No for internal and external links) ... yes
√ Number of concurrent requests ... 100
√ Timeout value (in milliseconds) ... 10000
√ Select output options » Broken, Skipped
√ Save output to file? ... yes
√ Output file root filename (no extension) ... link-checker-results
√ Output format » Markdown (.md)

Starting scan...

--- scan activity here ---

Results successfully written to file: D:\dev\links\link-checker-results.md

Scan Results
==============================
Found: 5,785 links
Scanned: 4,166 links
Broken: 42 links
Skipped: 23 links
==============================
```

### Automated Operation

To facilitate saving default scan settings in a project folder, the utility supports **Auto** mode. With Auto mode, you: 

Run the `checklinks` command the `-s` flag: `checklinks -s`. This causes the utility to prompt you for configuration settings as usual, but then writes all of your choices to a file called `link-checker-config.json` in the current folder. Once it completes writing the settings to the file, the utility exits.

The output looks like this: 

``` text
┌──────────────────┐
│                  │
│   Link Checker   │
│                  │
└──────────────────┘

by John M. Wargo (https://johnwargo.com)

? Target site URL » http://localhost:8080
√ Target site URL ... http://localhost:8080
√ Test internal links only? (No for internal and external links) ... yes
√ Number of concurrent requests; must be greater than zero ... 10
√ Timeout value (in milliseconds); must be greater than zero ... 5000
√ Select output options » Broken
√ Save output to file? ... yes
√ Output file root filename (no extension) ... link-checker-results
√ Output format » Markdown (.md)

Saving configuration to D:\dev\node\link-checker\link-checker-config.json
```

Next, run the `checklinks` command with the `-a` flag: `checklinks -a`

``` text
┌──────────────────┐
│                  │
│   Link Checker   │
│                  │
└──────────────────┘

by John M. Wargo (https://johnwargo.com)

Auto mode enabled
Starting scan...

--- scan activity here ---

Results successfully written to file: D:\dev\node\link-checker\link-checker-results.md
Opening report in Visual Studio Code

Scan Results
==============================
Found: 5,785 links
Scanned: 4,166 links
Broken: 5 links
==============================
```

## Status Codes

When you look at scan results, you may see some status codes that don't make sense compared to what you know about HTTP result codes. The following table explains the weird ones I saw when testing the utility.

| Status Code | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| 0           | Generally, a status code of 0 means an undefined server error, but only when dealing with HTTP requests. In this case, it simply means that the URL validation library used internally by the utility skipped the URL because it wasn't an HTTP-based link. This happens for `tel`, `mailto`, and similar link types. |
| 999         | From [Uptime Robot](https://uptimerobot.com/blog/999-status-code/): When a system detects an overwhelming amount of requests, it responds with the 999 status code, basically telling the client, “You're overdoing it. Slow down!” Think of it as a speed limit for data seekers.<br />I also noticed that [LinkedIn](https://www.linkedin.com/) returns a 999 error pretty consistently. |

If you encounter a new one, please create an [issue here](https://github.com/johnwargo/link-checker/issues) and let me know so I can add it to the table.

## False Positives

The utility sometimes returns false positives. For example, the 403 errors shown below. In that example, those are valid URLs, but the site blocks the request due to a human check the site performs before letting a visitor access the target page.

![Link Checker Results Report](/images/link-cheker-results-md.png)

For this reason, you should double-check the broken links to validate they're actually broken.

## Command-line Arguments

The utility supports a very limited number of command-line options:

| Flag | Description |
| ---- | ----------- |
| -?   | Displays the contents of a help file in the console. |
| -a   | Enables auto mode (see [Automated Operation](#automated-operation)) |
| -d   | Enables `debugMode` in the utility which causes it to write additional information (not much really) to the terminal window as it works. |
| -s   | Write configuration choices to `link-checker-config.json` (see [Automated Operation](#automated-operation)) |

## Background

As I wrote in [Migrating This Site from Joomla To Eleventy](https://johnwargo.com/posts/2023/migrating-a-joomla-site-to-eleventy/), I built some custom tooling and migrated my personal blog from Joomla to Eleventy. As part of that process, I fixed all of the links I found, but never ran a link checker to validate the links across the site. Now, more than a year later, I decided to actually run a link checker on the site to see what I'd find. 

I started with the [W3C Link Checker](https://validator.w3.org/checklink) and learned a lot about my site. I fixed some of the links, but I found that the way the utility worked didn't work for me. I wanted a report I could study and work through.

Very soon thereafter, I found an article that got me started on the path to create this utility. The article is [Using Node.js to Check for Broken Links](https://www.seancdavis.com/posts/using-nodejs-to-check-for-broken-links/) and it showed me how to use the [Linkinator](https://www.npmjs.com/package/linkinator) library to build a command-line driven link checker. Once I had that working using the code from the article, I realized that I wanted very different functionality for my personal use and built out this utility. My biggest requirement was a savable report on broken links.

I hope you like it. 

***

If this code helps you, please consider buying me a coffee.

<a href="https://www.buymeacoffee.com/johnwargo" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>