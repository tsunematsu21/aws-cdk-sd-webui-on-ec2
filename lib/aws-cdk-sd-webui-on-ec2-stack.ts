import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface StableDiffusionWebUiPrepareStackProps extends cdk.StackProps {
  allowInboundCidr?: string;
  instanceSize?: ec2.InstanceSize;
}

export class StableDiffusionWebUiPrepareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StableDiffusionWebUiPrepareStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 1,
      subnetConfiguration: [{
        cidrMask: 28,
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
      }],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
    });

    if (props.allowInboundCidr) {
      securityGroup.addIngressRule(ec2.Peer.ipv4(props.allowInboundCidr), ec2.Port.tcp(7860));
    }

    const role = new iam.Role(this, 'Role', {
      roleName: `${id}.Role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `stable-diffusion-web-ui-bucket-${props.env?.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    bucket.grantReadWrite(role);

    const instanceSize = props.instanceSize ?? ec2.InstanceSize.XLARGE;
    const instanceType = ec2.InstanceType.of(ec2.InstanceClass.G4DN, instanceSize);
    const machineImage = ec2.MachineImage.lookup({
      name: 'Deep Learning AMI GPU PyTorch 2.0.1 (Ubuntu 20.04) 20231003',
      owners: ['amazon'],
    });

    const userData = ec2.UserData.forLinux();

    userData.addCommands(
      'sudo apt update',

      // Mount instance store
      'sudo mkfs -t xfs /dev/nvme1n1',
      'sudo mkdir -p /is',
      'sudo mount /dev/nvme1n1 /is',
      'sudo chown ubuntu /is/',

      // Install Stable Diffusion web UI
      'sudo apt -y install wget git python3 python3-venv libgl1 libglib2.0-0',
      'sudo -u ubuntu git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git /is/stable-diffusion-webui',

      // Install Stable Diffusion web UI extentions
      'sudo -u ubuntu git clone https://github.com/AlUlkesh/stable-diffusion-webui-images-browser/ /is/stable-diffusion-webui/extensions/stable-diffusion-webui-images-browser',
      'sudo -u ubuntu git clone "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete.git" /is/stable-diffusion-webui/extensions/tag-autocomplete',

      // Download models from s3
      `sudo -u ubuntu aws s3 cp s3://${bucket.bucketName}/models /is/stable-diffusion-webui/models --recursive`,
    );

    const instanceName = `${id}/${instanceType.toString()}`;
    const launchTemplateName = `${id}/${instanceType.toString()}`;
    const launchTemplate = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateName,
      launchTemplateData: {
        iamInstanceProfile: {
          arn: new iam.CfnInstanceProfile(this, 'CfnInstanceProfile', {
            roles: [role.roleName],
          }).attrArn,
        },
        imageId: machineImage.getImage(this).imageId,
        instanceInitiatedShutdownBehavior: "terminate",
        instanceType: instanceType.toString(),
        maintenanceOptions: { autoRecovery: 'disabled' },
        monitoring: { enabled: false },
        networkInterfaces: [{
          associatePublicIpAddress: true,
          deleteOnTermination: true,
          description: "ENI",
          deviceIndex: 0,
          groups: [securityGroup.securityGroupId],
          subnetId: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }).subnetIds[0],
        }],
        privateDnsNameOptions: { hostnameType: 'resource-name' },
        tagSpecifications: [{
          resourceType: "instance",
          tags: [
            { key: "Name", value: instanceName },
            { key: "LaunchTemplateName", value: launchTemplateName },
          ],
        }],
        userData: cdk.Fn.base64(userData.render()),
      },
    });

    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'BucketConsoleUrl', {
      value: `https://s3.console.aws.amazon.com/s3/buckets/${bucket.bucketName}?region=${props.env?.region}&tab=objects`
    });
    new cdk.CfnOutput(this, 'LaunchTemplateId', { value: launchTemplate.ref });
    new cdk.CfnOutput(this, 'LaunchTemplateName', { value: launchTemplate.launchTemplateName ?? '' });
    new cdk.CfnOutput(this, 'InstanceName', { value: instanceName });
  }
}
