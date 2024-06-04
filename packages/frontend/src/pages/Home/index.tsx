/*! Copyright [Amazon.com](http://amazon.com/), Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { useCognitoAuthContext } from "@aws-northstar/ui";
import {
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  Button,
  Box,
  // Spinner,
} from "@cloudscape-design/components";

import { useContext } from "react";

import { RuntimeConfigContext } from "../../components/RuntimeContext";

/**
 * Component to render the home "/" route.
 */
const Home: React.FC = () => {
  const runtimeContext = useContext(RuntimeConfigContext);
  const { getAuthenticatedUserSession } = useCognitoAuthContext();

  async function testEcho() {
    const url = runtimeContext!.apiUrl + "echo";
    const session = await getAuthenticatedUserSession();
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: session!.getIdToken().getJwtToken() },
    });
    const data = await res.json();
    console.log(data);
  }

  return (
    <ContentLayout
      header={
        <Header>MLOps Prototype for Recommendation models</Header>
      }
    >
      <SpaceBetween size="xl">
        <Container header={<Header>Prototype Demo</Header>}>
          <div>
            <div>
              <ul>
                <li>Realtime inference via REST API</li>
                <li>Dynamic inference endpoint routing demo for A/B Testing</li>
              </ul>
            </div>
          </div>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default Home;
