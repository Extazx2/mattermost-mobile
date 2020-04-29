// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionFunc, DispatchFunc, SuccessResult, ErrorResult} from '@mm-redux/types/actions';

const MAX_TRIES = 3;

export function dispatchWithRetry(action: ActionFunc, maxTries = MAX_TRIES): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        const response = await dispatch(doDispatchWithRetry(action, maxTries));

        return response;
    };
}

function doDispatchWithRetry(action: ActionFunc, maxTries: number, attempt: number = 1): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        let result;
        try {
            result = await dispatch(action);
        } catch (error) {
            result = {error};
        }

        const {error} = <ErrorResult>result;
        if (!error || attempt >= maxTries) {
            return result;
        }

        return await dispatch(doDispatchWithRetry(action, maxTries, attempt + 1));
    };
}

export async function promisesWithRetry(promises: Promise<SuccessResult|ErrorResult>[], maxTries = MAX_TRIES): Promise<any[]|ErrorResult> {
    const results = await doPromisesWithRetry(promises, maxTries);

    return results;
}

async function doPromisesWithRetry(promises: Promise<SuccessResult|ErrorResult>[], maxTries = MAX_TRIES, attempt: number = 1): Promise<any[]|ErrorResult> {
    let results;
    try {
        results = await Promise.all(promises);
    } catch (error) {
        results = {error};
    }

    const {error} = <ErrorResult>results;
    if (!error || attempt >= maxTries) {
        return results;
    }

    return await doPromisesWithRetry(promises, maxTries, attempt + 1);
} 