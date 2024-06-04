import { useCognitoAuthContext } from "@aws-northstar/ui";
import {
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  Button,
  Form,
  FormField,
  Input,
  Box,
  // Spinner,
} from "@cloudscape-design/components";

import { useContext, useState } from "react";
import { RuntimeConfigContext } from "../../components/RuntimeContext";

/**
 * Component to render the RealtimeInference "/demo/realtime-inference" route.
 */
const RealtimeInference: React.FC = () => {
  const runtimeContext = useContext(RuntimeConfigContext);
  const { getAuthenticatedUserSession } = useCognitoAuthContext();

  const [requesterIdValue, setRequesterIdValue] = useState("proto-user");
  const [requesterSessionValue, setRequesterSessionValue] = useState(
    "7d4c48f8-5bc8-4f28-8631-5d263ec7396d",
  );
  const [usersValue, setUsersValue] = useState("0, 0, 0, 0, 0, 0, 0, 0, 0, 0");
  const [itemsValue, setItemsValue] = useState(
    "25, 1064, 174, 2791, 3373, 269, 2678, 1902, 3641, 1216",
  );

  const [recommendationsValue, setReCommendationsValue] = useState<any>();

  const onRecommendationClick = async () => {
    console.log("Get Recommendation");

    // get recommendation
    const recomm = await getRecommendation();
    console.log(recomm);

    // set item details
    setReCommendationsValue(recomm);
  };

  async function getRecommendation() {
    const url = `${runtimeContext!.apiUrl}abtest`;
    const apiKey = `${runtimeContext!.apiKey}`;
    const session = await getAuthenticatedUserSession();
    try {
      let reqData: any = {
        user_id: requesterIdValue,
        session_id: requesterSessionValue,
        data: {
          user: usersValue.split(",").map((i) => parseInt(i)),
          item: itemsValue.split(",").map((i) => parseInt(i)),
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: session!.getIdToken().getJwtToken(),
          "x-api-key": apiKey,
        },
        body: JSON.stringify(reqData),
      });

      const recommendations = await res.json();
      return recommendations;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  return (
    <ContentLayout
      header={
        <Header description="MLOps Prototype">Realtime Inference Demo</Header>
      }
    >
      <SpaceBetween direction="vertical" size="xs">
        <Container header={<Header>Request form</Header>}>
          <form onSubmit={(event) => event.preventDefault()}>
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    data-testid="get-recommendation"
                    variant="primary"
                    onClick={onRecommendationClick}
                  >
                    Get Recommendation
                  </Button>
                </SpaceBetween>
              }
            >
              <FormField label="Requester ID">
                <Input
                  value={requesterIdValue}
                  onChange={(event) => setRequesterIdValue(event.detail.value)}
                />
              </FormField>
              <FormField label="Session ID">
                <Input
                  value={requesterSessionValue}
                  onChange={(event) =>
                    setRequesterSessionValue(event.detail.value)
                  }
                />
              </FormField>
              <FormField label="Users">
                <Input
                  value={usersValue}
                  onChange={(event) => setUsersValue(event.detail.value)}
                />
              </FormField>
              <FormField label="Items">
                <Input
                  value={itemsValue}
                  onChange={(event) => setItemsValue(event.detail.value)}
                />
              </FormField>
            </Form>
          </form>
        </Container>
        {recommendationsValue && (
          <Container header={<Header>User Info</Header>}>
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Event ID</Box>
                <div>{recommendationsValue.event_id}</div>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Requester ID</Box>
                <div>{recommendationsValue.user_id}</div>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Requester Session</Box>
                <div>{recommendationsValue.session_id}</div>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Sagemaker Endpoint</Box>
                <div>{recommendationsValue.sagemaker_endpoint_name}</div>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Inference Result</Box>
                <div>{recommendationsValue.response_data}</div>
              </div>
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
};

export default RealtimeInference;
