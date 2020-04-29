// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionFunc, DispatchFunc, GetStateFunc, batchActions} from '@mm-redux/types/actions';

import EventEmitter from '@mm-redux/utils/event_emitter';

import {getCurrentTeamId, getTeamByName} from '@mm-redux/selectors/entities/teams';
import {
    getChannel,
    getChannelByName,
    getMyChannelMember,
    getCurrentChannelId,
    getRedirectChannelForTeam,
} from '@mm-redux/selectors/entities/channels';

import {selectTeam} from '@mm-redux/actions/teams';
import {selectChannel} from '@actions/channels';
import {markChannelAsViewedAndReadActions} from '@actions/helpers/channels';
import {loadPostsIfNecessaryWithRetry} from '@actions/views/post';

import {
    getLastViewedChannelForTeam,
    getPenultimateViewedChannelForTeam,
} from '@selectors/views';

import {DEFAULT_CHANNEL_NOT_FOUND} from '@constants/channel';

import {canSelectChannel} from '@utils/users';
import {t} from '@utils/i18n';

export function handleSelectChannel(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const dt = Date.now();

        const state = getState();
        const currentChannelId = getCurrentChannelId(state);
        if (channelId === currentChannelId) {
            return {data: false};
        }

        const currentTeamId = getCurrentTeamId(state);
        const channel = getChannel(state, channelId);
        const member = getMyChannelMember(state, channelId);

        dispatch(loadPostsIfNecessaryWithRetry(channelId));

        if (channel && currentChannelId !== channelId) {
            const actions = markChannelAsViewedAndReadActions(state, channelId, currentChannelId);

            const extra = {
                channel,
                member,
                teamId: channel.team_id || currentTeamId,
            };
            actions.push(selectChannel(channelId, extra));

            dispatch(batchActions(actions, 'BATCH_SWITCH_CHANNEL'));
        }

        console.log('channel switch to', channel?.display_name, channelId, (Date.now() - dt), 'ms'); //eslint-disable-line

        return {data: true};
    };
}

export function selectRedirectChannelForTeam(teamId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const channel = getRedirectChannelForTeam(state, teamId);

        if (!channel) { 
            const error = {
                id: t('mobile.default_channel.error'),
                defaultMessage: 'A default channel for this team was not found.',
            };
            EventEmitter.emit(DEFAULT_CHANNEL_NOT_FOUND, error);

            return {error};
        }

        dispatch(handleSelectChannel(channel.id));

        return {data: true};
    };
}

export function selectLastViewedChannelForTeam(teamId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        let channel = getLastViewedChannelForTeam(state, teamId);

        if (canSelectChannel(state, channel)) {
            dispatch(handleSelectChannel(channel.id));
        } else {
            dispatch(selectRedirectChannelForTeam(teamId));
        }

        return {data: true};
    };
}

export function selectPenultimateViewedChannelForTeam(teamId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        let channel = getPenultimateViewedChannelForTeam(state, teamId);

        if (canSelectChannel(state, channel)) {
            dispatch(handleSelectChannel(channel.id));
        } else {
            dispatch(selectRedirectChannelForTeam(teamId));
        }

        return {data: true};
    };
}

export function selectChannelFromDeepLinkMatch(channelName: string, teamName: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let error;
        const state = getState();

        const team = getTeamByName(state, teamName);
        if (!team) {
            error = {
                id: t('mobile.server_link.unreachable_team.error'),
                defaultMessage: 'This link belongs to a deleted team or to a team to which you do not have access.',
            };

            return {error};
        }
    
        const channel = getChannelByName(state, channelName);
        if (!channel) {
            error = {
                id: t('mobile.server_link.unreachable_channel.error'),
                defaultMessage: 'This link belongs to a deleted channel or to a channel to which you do not have access.',
            };

            return {error};
        }

        if (channel && channel.team_id !== team.id) {
            error = {
                id: t('mobile.server_link.error.text'),
                defaultMessage: 'The link could not be found on this server.',
            }

            return {error};
        }

        const currentChannelId = getCurrentChannelId(state);
        const currentTeamId = getCurrentTeamId(state);
        if (channel.id !== currentChannelId) {
            if (team.id !== currentTeamId) {
                dispatch(selectTeam(team));
            }

            dispatch(handleSelectChannel(channel.id));
        }

        return {data: true};
    };
}