#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StableDiffusionWebUiPrepareStack } from '../lib/aws-cdk-sd-webui-on-ec2-stack';

const app = new cdk.App();
new StableDiffusionWebUiPrepareStack(app, 'AwsCdkSdWebuiOnEc2Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  allowInboundCidr: process.env.ALLOW_INBOUND_CIDR,
});
