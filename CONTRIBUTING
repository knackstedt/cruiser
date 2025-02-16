# Contributing Guidelines

Thank you for considering contributing to Cruiser! We are excited about your interest in helping us improve and maintain this open-source project. Please read through these guidelines before submitting a pull request or suggesting any changes, as by doing so, you agree with the following rules:

## Getting Started

### Prerequisites

Before starting your contribution, make sure to have NodeJS (V22, V20) installed on your machine. For TypeScript and Angular development we recommend using Visual Studio Code which can be downloaded [here](https://code.visualstudio.com/). You also need NPM or PNPM package management in the project. Yarn is **NOT** to be used. Any issues opened due to the use of yarn will be closed without further review. You have been warned.

### Cloning the Repository

To contribute, you first need to fork this repository by clicking on the "Fork" button at the top right corner of this GitHub page. Clone your fork locally:

```bash
git clone https://github.com/your-username/cruiser.git
cd cruiser
npm install
```

## Starting the development systems

### VSCode

Within our repo, we include several recommended extensions -- install them. Once you have them installed, there are a few notable things to point out. One being that there are 3 tasks in your status bar (the horizontal bar at the bottom of VSCode). The `▶ web` task will start the Angular dev server. Generally you won't need to restart this unless you change the angular.json file or something in the proxy.config.json file. The `▶ surrealdb` task will start a SurrealDB instance with preset values for the username and password. This will store data locally to the project folder. The `▶ otel viewer` task will start an OpenTelemetry reciever that provides a web interface to inspect OpenTelemetry traces. You don't need this running unless you're debugging something around Otel.

## Synchronizing changes

After you have made your changes in your fork and tested them thoroughly locally. Create a pull request to merge your code into the master branch of the main project repository. Your code will be reviewed, and you may have to make some adjustments before it may be merged.

## Making code changes

### Writing code

Please follow the general code styles. We have not yet configured a linter or formal code style definition.

### Test your changes locally

Before submitting your pull request make sure that everything works as expected locally:

1. Exercise the functionality you're adding -- make sure to check for regressions or other edge cases your changes may impact.
2. Ensure that all new code and major modifications have been documented with comments, which will aid developers trying to understand what you did or debug problems resulting from your changes.
3. Check whether there are any warnings or errors left from eslint or any other tooling. If so, fix them before submitting your pull request.

## Submitting Your Changes For Review

When you are ready to submit your changes for approval, follow these steps:

1. Ensure that all new features and modifications work as expected locally by following above instructions on testing before submitting pull requests after making significant changes or creating a feature. This will help avoid having regressions in behavior due to unforeseen bugs cropping up unexpectedly while being reviewed by other members of this project repository's team!
2. Create a pull request, providing as much detail about your change(s) and why you believe they are necessary for improving or fixing existing functionality. We urge you to add documentation especially if there is any complexity involved in understanding how exactly these changes affect overall system behavior.
3. Once you have submitted the pull request, patiently wait for feedback from members of this project repository's team who will review your code and inform you if further improvements or corrections are necessary before merging the PR.

