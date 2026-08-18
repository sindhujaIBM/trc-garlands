import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  stage: string;
}

/**
 * S3 buckets + lifecycle policies (architecture-plan.md §1 data layer).
 * Media: Standard for active photos, Glacier after 1 year.
 */
export class StorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;
  public readonly invoicesBucket: s3.Bucket;
  public readonly mediaDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
    const { stage } = props;

    const removalPolicy =
      stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `${stage}-trcgarlands-media`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: stage !== 'prod',
      cors: [
        {
          // Pre-signed uploads from phone browsers (admin PWA)
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'], // TODO: restrict to site domains before prod
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'archive-old-media',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    this.invoicesBucket = new s3.Bucket(this, 'InvoicesBucket', {
      bucketName: `${stage}-trcgarlands-invoices`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: stage !== 'prod',
      // Orders retained 7 years (CRA requirement) — no expiry rule.
    });

    // Media bucket stays private (BLOCK_ALL); CloudFront reads it via Origin
    // Access Control so product/gallery photos are publicly servable without
    // opening the bucket itself. Origin stays in ca-west-1 (PIPEDA data
    // residency, architecture-plan.md §8) — CloudFront edge caching doesn't
    // move the source of truth, matching the $0 free-tier line item already
    // budgeted in architecture-plan.md §2.
    this.mediaDistribution = new cloudfront.Distribution(this, 'MediaDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName });
    new cdk.CfnOutput(this, 'MediaDistributionDomain', {
      value: this.mediaDistribution.distributionDomainName,
    });
  }
}
