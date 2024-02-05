import { memo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

import { useQuery } from "@/containers/Apollo";
import { TeamUpgradeDialogButton } from "@/containers/Team/UpgradeDialog";
import { FragmentType, graphql, useFragment } from "@/gql";
import {
  Permission,
  AccountSubscriptionStatus,
  AccountSubscriptionProvider,
} from "@/gql/graphql";
import { Banner, BannerProps } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Container } from "@/ui/Container";
import { StripePortalLink } from "@/ui/StripeLink";
import { Time } from "@/ui/Time";

const PaymentBannerFragment = graphql(`
  fragment PaymentBanner_Account on Account {
    id
    permissions
    stripeCustomerId
    pendingCancelAt

    subscription {
      id
      status
      trialDaysRemaining
      provider
      paymentMethodFilled
    }

    plan {
      id
      displayName
      free
    }
  }
`);

const PaymentBannerQuery = graphql(`
  query PaymentBanner_me {
    me {
      id
      hasSubscribedToTrial
    }
  }
`);

function SettingsButton(props: { children: React.ReactNode }) {
  const { accountSlug } = useParams();
  return (
    <Button>
      {(buttonProps) => (
        <RouterLink to={`/${accountSlug}/settings`} {...buttonProps}>
          {props.children ?? "Manage subscription"}
        </RouterLink>
      )}
    </Button>
  );
}

function ManageStripeButton(props: {
  stripeCustomerId: string | null;
  accountId: string;
  children: React.ReactNode;
}) {
  if (props.stripeCustomerId) {
    return (
      <StripePortalLink
        stripeCustomerId={props.stripeCustomerId}
        accountId={props.accountId}
        asButton
      >
        {props.children ?? "Manage subscription"}
      </StripePortalLink>
    );
  }
  return (
    <TeamUpgradeDialogButton initialAccountId={props.accountId}>
      {props.children ?? "Upgrade to Pro plan"}
    </TeamUpgradeDialogButton>
  );
}

function ManageButton(props: {
  subscription: {
    provider: AccountSubscriptionProvider;
  } | null;
  stripeCustomerId: string | null;
  accountId: string;
  children?: React.ReactNode;
}) {
  if (props.subscription?.provider === AccountSubscriptionProvider.Stripe) {
    return (
      <ManageStripeButton
        stripeCustomerId={props.stripeCustomerId}
        accountId={props.accountId}
      >
        {props.children}
      </ManageStripeButton>
    );
  }
  return <SettingsButton>{props.children}</SettingsButton>;
}

function BannerTemplate(props: {
  color: BannerProps["color"];
  children: React.ReactNode;
}) {
  return (
    <Banner className="flex justify-center" color={props.color ?? "neutral"}>
      <Container className="flex items-center justify-center gap-2">
        {props.children}
      </Container>
    </Banner>
  );
}

export const PaymentBanner = memo(
  (props: { account: FragmentType<typeof PaymentBannerFragment> }) => {
    const account = useFragment(PaymentBannerFragment, props.account);
    const { data: { me } = {} } = useQuery(PaymentBannerQuery);

    const {
      subscription,
      permissions,
      stripeCustomerId,
      pendingCancelAt,
      plan,
    } = account;

    if (!me) {
      return null;
    }

    const userIsOwner = permissions.includes(Permission.Write);

    // No banner for free plan (Hobby)
    if (plan?.free) {
      return null;
    }

    if (!plan || !subscription) {
      return (
        <BannerTemplate color="danger">
          <p>Upgrade to Pro plan to use Team features.</p>
          {userIsOwner && (
            <ManageButton
              subscription={subscription ?? null}
              stripeCustomerId={stripeCustomerId ?? null}
              accountId={account.id}
            />
          )}
        </BannerTemplate>
      );
    }

    switch (subscription.status) {
      case AccountSubscriptionStatus.PastDue: {
        return (
          <BannerTemplate color="danger">
            <p>
              Your subscription is past due. Please update your payment method.
            </p>
            {userIsOwner && (
              <ManageButton
                subscription={subscription ?? null}
                stripeCustomerId={stripeCustomerId ?? null}
                accountId={account.id}
              >
                Upgrade payment method
              </ManageButton>
            )}
          </BannerTemplate>
        );
      }

      case AccountSubscriptionStatus.Canceled: {
        return (
          <BannerTemplate color="danger">
            <p>Upgrade to Pro plan to use team features.</p>
            {userIsOwner && (
              <ManageButton
                subscription={subscription ?? null}
                stripeCustomerId={stripeCustomerId ?? null}
                accountId={account.id}
              >
                Manage subscription
              </ManageButton>
            )}
          </BannerTemplate>
        );
      }

      case AccountSubscriptionStatus.Active:
      case AccountSubscriptionStatus.Trialing: {
        if (!subscription.paymentMethodFilled) {
          const daysRemaining = subscription.trialDaysRemaining;
          return (
            <BannerTemplate
              color={
                !daysRemaining || daysRemaining < 5 ? "warning" : "neutral"
              }
            >
              <p>
                {daysRemaining ? (
                  <>Your trial ends in ${daysRemaining} days. </>
                ) : null}
                Add a payment method to retain access to team features.
              </p>
              {userIsOwner && (
                <ManageButton
                  subscription={subscription ?? null}
                  stripeCustomerId={stripeCustomerId ?? null}
                  accountId={account.id}
                >
                  Add payment method
                </ManageButton>
              )}
            </BannerTemplate>
          );
        }

        if (pendingCancelAt) {
          const subscriptionTypeLabel =
            subscription.status === AccountSubscriptionStatus.Trialing
              ? "trial"
              : "subscription";
          return (
            <BannerTemplate color="warning">
              <p>
                Your {subscriptionTypeLabel} has been canceled. You can still
                use team features until the{" "}
                <Time date={pendingCancelAt} format="LL" />.
              </p>
              {userIsOwner && (
                <ManageButton
                  subscription={subscription ?? null}
                  stripeCustomerId={stripeCustomerId ?? null}
                  accountId={account.id}
                >
                  Reactivate {subscriptionTypeLabel}
                </ManageButton>
              )}
            </BannerTemplate>
          );
        }
        return null;
      }
    }
    return null;
  },
);
