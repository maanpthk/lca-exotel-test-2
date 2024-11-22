// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useState, useEffect } from 'react';

import { Auth, Logger } from 'aws-amplify';
import { AuthState } from '@aws-amplify/ui-components';

const DEFAULT_CREDS_REFRESH_INTERVAL_IN_MS = 60 * 15 * 1000;

const logger = new Logger('useCurrentSessionCreds');

const useCurrentSessionCreds = ({
  authState,
  credsIntervalInMs = DEFAULT_CREDS_REFRESH_INTERVAL_IN_MS,
}) => {
  const [currentSession, setCurrentSession] = useState();
  const [currentCredentials, setCurrentCredentials] = useState();
  let interval;

  const refreshCredentials = async () => {
    try {
      setCurrentSession(await Auth.currentSession());
      setCurrentCredentials(await Auth.currentUserCredentials());
      logger.debug('successfully refreshed credentials');
    } catch (error) {
      // XXX surface credential refresh error
      logger.error('failed to get credentials', error);
    }
  };
  const clearRefreshInterval = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  useEffect(() => {
    if (authState === AuthState.SignedIn) {
      if (!interval) {
        refreshCredentials();
        interval = setInterval(refreshCredentials, credsIntervalInMs);
      } else {
        clearRefreshInterval();
        interval = setInterval(refreshCredentials, credsIntervalInMs);
      }
    } else {
      clearRefreshInterval();
    }
    if (authState === AuthState.SignedOut) {
      clearRefreshInterval();
      setCurrentSession();
      setCurrentCredentials();
    }

    return () => {
      clearRefreshInterval();
    };
  }, [authState, credsIntervalInMs]);

  return { currentSession, currentCredentials };
};

export default useCurrentSessionCreds;
