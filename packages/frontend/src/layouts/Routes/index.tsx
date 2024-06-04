/*! Copyright [Amazon.com](http://amazon.com/), Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as React from "react";
import { Route, Routes as ReactRoutes } from "react-router-dom";
import Home from "../../pages/Home";
import RealtimeInference from "../../pages/InferenceDemo";

/**
 * Defines the Routes.
 */
const Routes: React.FC = () => {
  return (
    <ReactRoutes>
      <Route key={0} path="/" element={<Home />} />
      <Route
        key={1}
        path="/demo/realtime-inference"
        element={<RealtimeInference />}
      />
    </ReactRoutes>
  );
};

export default Routes;
