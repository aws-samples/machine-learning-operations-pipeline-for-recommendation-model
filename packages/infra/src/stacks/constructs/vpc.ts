/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { RemovalPolicy } from "aws-cdk-lib";
import { FlowLogDestination, FlowLogTrafficType, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { namespaced } from "../../util/common";

export interface IVpcServiceProps {
  readonly namespace: string;
  readonly vpcName: string;
  readonly removalPolicy: RemovalPolicy;
  readonly maxAzs?: number;
}

export class VpcService extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: IVpcServiceProps) {
    super(scope, id);
    const { namespace, vpcName, removalPolicy, maxAzs } = props;
    this.vpc = new Vpc(this, `${id}Vpc`, {
      maxAzs: maxAzs ? maxAzs : 1, // TO-DO : review in production
      vpcName: namespaced(vpcName, namespace),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        },
        {
          cidrMask: 24,
          name: "private_egress",
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: 1, // TO-DO : review in production
      flowLogs: {
        cloudwatch: {
          destination: FlowLogDestination.toCloudWatchLogs(
            new LogGroup(this, `${id}Log`, {
              logGroupName: `/aws/vpc/${namespace}/${id}/flowlogs`,
              retention: RetentionDays.ONE_MONTH,
              removalPolicy: removalPolicy,
            }),
          ),
          trafficType: FlowLogTrafficType.ALL,
        },
      },
    });
    this.vpc.applyRemovalPolicy(removalPolicy);
  }
}
