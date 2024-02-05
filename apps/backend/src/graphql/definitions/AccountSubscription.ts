import gqlTag from "graphql-tag";

import type { IResolvers } from "../__generated__/resolver-types.js";

const { gql } = gqlTag;

export const typeDefs = gql`
  enum AccountSubscriptionStatus {
    "Ongoing paid subscription"
    active
    "Ongoing trial"
    trialing
    "Payment due"
    past_due
    "Post-cancelation date"
    canceled
    "Incomplete"
    incomplete
    "Incomplete expired"
    incomplete_expired
    "Unpaid"
    unpaid
    "Paused"
    paused
  }

  enum AccountSubscriptionProvider {
    github
    stripe
  }

  type AccountSubscription implements Node {
    id: ID!
    provider: AccountSubscriptionProvider!
    trialDaysRemaining: Int
    paymentMethodFilled: Boolean!
    status: AccountSubscriptionStatus!
  }
`;

export const resolvers: IResolvers = {
  AccountSubscription: {
    trialDaysRemaining: (subscription) => {
      if (!subscription.trialEndDate) {
        return null;
      }
      const trialEndDate = new Date(subscription.trialEndDate).getTime();
      const now = Date.now();
      if (trialEndDate < now) {
        return null;
      }
      const remainingTime =
        new Date(subscription.trialEndDate).getTime() - Date.now();
      return Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
    },
  },
};
