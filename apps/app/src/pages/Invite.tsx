import { useMutation } from "@apollo/client";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { AccountAvatar } from "@/containers/AccountAvatar";
import { useQuery } from "@/containers/Apollo";
import { useIsLoggedIn } from "@/containers/Auth";
import { LoginButtons } from "@/containers/LoginButtons";
import { graphql } from "@/gql";
import { Button } from "@/ui/Button";
import { Container } from "@/ui/Container";
import { PageLoader } from "@/ui/PageLoader";

const InvitationQuery = graphql(`
  query Invite_invitation($token: String!) {
    invitation(token: $token) {
      id
      name
      slug
      avatar {
        ...AccountAvatarFragment
      }
    }

    me {
      teams {
        id
      }
    }
  }
`);

const AcceptInvitationMutation = graphql(`
  mutation Invite_acceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      id
      slug
    }
  }
`);

const JoinTeamButton = (props: {
  token: string;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const [accept, { data, loading }] = useMutation(AcceptInvitationMutation, {
    variables: {
      token: props.token,
    },
    onCompleted(data) {
      const team = data.acceptInvitation;
      const teamUrl = `/${team.slug}`;
      navigate(teamUrl, { replace: true });
    },
  });
  return (
    <Button
      size="large"
      disabled={loading || !!data}
      onClick={() => {
        accept();
      }}
    >
      {props.children}
    </Button>
  );
};

export const Invite = () => {
  const loggedIn = useIsLoggedIn();
  const params = useParams();
  const token = params.inviteToken;
  if (!token) {
    throw new Error("No invite token");
  }
  const { data } = useQuery(InvitationQuery, {
    variables: {
      token,
    },
  });

  const team = data?.invitation;
  const teamName = team?.name || team?.slug;
  const teamTitle = teamName ? `${team?.name || team?.slug} Team` : `Team`;

  return (
    <>
      <Helmet>
        <title>{`Join ${teamTitle}`}</title>
      </Helmet>
      <Container className="mt-32 text-center">
        {(() => {
          if (data) {
            const team = data.invitation;
            if (team) {
              if (!loggedIn) {
                return (
                  <div className="flex flex-col items-center">
                    <AccountAvatar avatar={team.avatar} size={72} />
                    <h1 className="my-4 text-4xl font-medium">
                      Join <strong>{teamTitle}</strong> on Argos.
                    </h1>
                    <p className="mb-10 text-xl">
                      Log in or create an account using GitHub to accept this
                      invitation.
                    </p>
                    <LoginButtons />
                  </div>
                );
              }
              const alreadyJoined = Boolean(
                data.me?.teams?.some((t) => t.id === team?.id)
              );
              if (alreadyJoined) {
                return (
                  <>
                    <h1 className="mb-4 text-4xl font-medium">
                      This invitation has already been accepted
                    </h1>
                    <p className="mb-10 text-xl">
                      You are a member of {teamTitle}.
                    </p>
                    <Button size="large">
                      {(buttonProps) => (
                        <RouterLink to={`/${team.slug}`} {...buttonProps}>
                          View Team Projects
                        </RouterLink>
                      )}
                    </Button>
                  </>
                );
              }
              return (
                <div className="flex flex-col items-center">
                  <AccountAvatar avatar={team.avatar} size={72} />
                  <h1 className="my-4 text-4xl font-medium">
                    Join <strong>{teamTitle}</strong> on Argos.
                  </h1>
                  <p className="mb-10 text-xl">
                    Let's use Argos to review visual differences in your
                    applications.
                  </p>
                  <JoinTeamButton token={token}>
                    Join {teamTitle}
                  </JoinTeamButton>
                </div>
              );
            }
            return (
              <>
                <h1 className="mb-4 text-4xl font-medium">
                  Invalid invitation
                </h1>
                <p className="mb-10 text-xl">
                  Team not found by the given invite code or user is not
                  authorized to join team.
                </p>
              </>
            );
          }
          return <PageLoader />;
        })()}
      </Container>
    </>
  );
};
