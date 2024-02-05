import { FragmentType, graphql, useFragment } from "@/gql";
import { AccountSubscriptionStatus } from "@/gql/graphql";
import { Chip, ChipColor } from "@/ui/Chip";

const AccountFragment = graphql(`
  fragment AccountPlanChip_Account on Account {
    subscription {
      id
      status
    }
    plan {
      id
      displayName
      free
    }
  }
`);

export const AccountPlanChip = (props: {
  account: FragmentType<typeof AccountFragment>;
  className?: string;
}) => {
  const account = useFragment(AccountFragment, props.account);
  const chipProps: { color: ChipColor; children: string } | null = (() => {
    if (!account.plan) {
      return { color: "danger", children: "No plan" };
    }
    if (account.plan.free) {
      return { color: "neutral", children: "Hobby" };
    }
    if (account.subscription) {
      switch (account.subscription.status) {
        case AccountSubscriptionStatus.Active:
          return { color: "info", children: account.plan.displayName };
        case AccountSubscriptionStatus.Trialing:
          return { color: "info", children: "Trial" };
        case AccountSubscriptionStatus.PastDue:
          return { color: "danger", children: "Past Due" };
        case AccountSubscriptionStatus.Unpaid:
          return { color: "danger", children: "Unpaid" };
        case AccountSubscriptionStatus.Canceled:
          return { color: "danger", children: "Canceled" };
        case AccountSubscriptionStatus.Incomplete:
          return { color: "danger", children: "Incomplete" };
        case AccountSubscriptionStatus.IncompleteExpired:
          return { color: "danger", children: "Expired" };
        default:
          return null;
      }
    }
    return null;
  })();
  if (!chipProps) {
    return null;
  }
  return <Chip scale="xs" className={props.className} {...chipProps} />;
};
