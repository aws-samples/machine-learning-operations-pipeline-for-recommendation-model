import { MonorepoTsProject } from "@aws/pdk/monorepo";
import { InfrastructureTsProject } from "@aws/pdk/infrastructure";
import { NodePackageManager, TrailingComma } from "projen/lib/javascript";
import { CloudscapeReactTsWebsiteProject } from "@aws/pdk/cloudscape-react-ts-website";
import { Project } from "projen/lib";

const project = new MonorepoTsProject({
  name: "proto-mlops",
  packageManager: NodePackageManager.PNPM,
  projenrcTs: true,
  defaultReleaseBranch: "main",
  gitignore: [".DS_Store"],
  vscode: true,
  licensed: true,
  license: "MIT-0",
  copyrightOwner: "Amazon.com, Inc.",
  devDeps: [
    "@aws/pdk",
  ],
});

// Lambda Functions & Layers
const lambda = new Project({
  parent: project,
  name: "lambda-src",
  outdir: "packages/lambda",
})
lambda.addGitIgnore("__pycache__")

// Backend and Infra
const infra = new InfrastructureTsProject({
  name: "infra",
  parent: project,
  outdir: "packages/infra",
  gitignore: [
    "__pycache__",
    "test/__snapshots__/",
    "config/local*",
    "scripts/*.json",
  ],
  devDeps: ["@types/node"],
  deps: [
    "@aws/pdk",
    "cdk-nag",
    "cdk-iam-actions",
    "cdk-constants",
    "find-up",
    "config",
  ],
  tsconfig: {
    compilerOptions: {
      noUnusedLocals: false,
      noUnusedParameters: false
    }
  },
  prettier: true,
  prettierOptions: {
    settings: {
      trailingComma: TrailingComma.ALL,
      printWidth: 160,
    },
  },
  licensed: false,
});
infra.eslint?.addRules({
  quotes: ["off", "double"],
});

// Frontend
const frontend = new CloudscapeReactTsWebsiteProject({
  parent: project,
  outdir: "packages/frontend",
  name: "MLOps Prototype",
  applicationName: "MLOps Prototype for Recommendation models",
  packageManager: NodePackageManager.PNPM,
  prettierOptions: {
    settings: {
      trailingComma: TrailingComma.ALL,
    },
  },
  tsconfig: {
    compilerOptions: {
      noUnusedLocals: false,
      noUnusedParameters: false
    }
  }
});
frontend.addScripts({"start": "react-scripts start"})
frontend.addGitIgnore("public/runtime-config.json")
project.addImplicitDependency(infra, frontend);

project.synth();