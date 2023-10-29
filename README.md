## Getting started

### Prepare AWS resources
```sh
# Install dependencies
npm install

# Set inbound cidr
export ALLOW_INBOUND_CIDR='YOUR_PUBLIC_IP/32'

# Deploy AWS reources
npx aws-cdk deploy
```

### Upload models
The EC2 instance mounts the `models` directory of the S3 bucket in the `models` directory of the installed Stable Diffusion web UI.  
Upload model files to the `models` directory of the S3 bucket according to the structure of the `models` directory in the Stable Diffusion web UI.
```sh
# e.g.
s3 cp $CHECKPOINT s3://$BUCKET_NAME/models/Stable-diffusion/
s3 cp $LORA s3://$BUCKET_NAME/models/Lora/
s3 cp $VAE s3://$BUCKET_NAME/models/VAE/
```

### Run and connect to instance for Stable Diffusion web UI
```sh
# Run instance by launch template
aws ec2 run-instances --launch-template LaunchTemplateId=$LAUNCH_TEMAPLTE_ID

# Describe instance status
aws ec2 describe-instance-status --instance-id $INSTANCE_ID

# Check web UI log using SSM session manager
aws ssm start-session --target $INSTANCE_ID
sudo su - ubuntu

cd /is/stable-diffusion-webui
./webui.sh --listen
```

Access to `http://<PUBLIC_IP>:17860`

### Terminate instance
```sh
# Terminate instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Describe instance status
aws ec2 describe-instance-status --instance-id $INSTANCE_ID
```
