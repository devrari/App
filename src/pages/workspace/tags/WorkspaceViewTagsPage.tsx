import {useIsFocused} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption} from '@components/ButtonWithDropdownMenu/types';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import TableListItem from '@components/SelectionList/TableListItem';
import SelectionListWithModal from '@components/SelectionListWithModal';
import CustomListHeader from '@components/SelectionListWithModal/CustomListHeader';
import Switch from '@components/Switch';
import useLocalize from '@hooks/useLocalize';
import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useNetwork from '@hooks/useNetwork';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSearchBackPress from '@hooks/useSearchBackPress';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';
import {
    clearPolicyTagErrors,
    clearPolicyTagListErrorField,
    clearPolicyTagListErrors,
    deletePolicyTags,
    openPolicyTagsPage,
    setPolicyTagsRequired,
    setWorkspaceTagEnabled,
} from '@libs/actions/Policy/Tag';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import localeCompare from '@libs/LocaleCompare';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import {getCleanedTagName, getTagListName, hasDependentTags as hasDependentTagsPolicyUtils, isMultiLevelTags as isMultiLevelTagsPolicyUtils} from '@libs/PolicyUtils';
import type {SettingsNavigatorParamList} from '@navigation/types';
import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import ToggleSettingOptionRow from '@pages/workspace/workflows/ToggleSettingsOptionRow';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {TagListItem} from './types';

type WorkspaceViewTagsProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.TAG_LIST_VIEW>;

function WorkspaceViewTagsPage({route}: WorkspaceViewTagsProps) {
    // We need to use isSmallScreenWidth instead of shouldUseNarrowLayout for the small screen selection mode
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {shouldUseNarrowLayout, isSmallScreenWidth} = useResponsiveLayout();
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>({});
    const dropdownButtonRef = useRef(null);
    const [isDeleteTagsConfirmModalVisible, setIsDeleteTagsConfirmModalVisible] = useState(false);
    const isFocused = useIsFocused();
    const policyID = route.params.policyID;
    const backTo = route.params.backTo;
    const policy = usePolicy(policyID);
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`);
    const {selectionMode} = useMobileSelectionMode();
    const currentTagListName = useMemo(() => getTagListName(policyTags, route.params.orderWeight), [policyTags, route.params.orderWeight]);
    const currentPolicyTag = policyTags?.[currentTagListName];
    const isQuickSettingsFlow = !!backTo;

    const fetchTags = useCallback(() => {
        openPolicyTagsPage(policyID);
    }, [policyID]);

    const {isOffline} = useNetwork({onReconnect: fetchTags});
    const canSelectMultiple = isSmallScreenWidth ? selectionMode?.isEnabled : true;

    useEffect(() => {
        if (isFocused) {
            return;
        }
        setSelectedTags({});

        return () => {
            setSelectedTags({});
            turnOffMobileSelectionMode();
        };
    }, [isFocused]);

    useSearchBackPress({
        onClearSelection: () => {
            setSelectedTags({});
        },
        onNavigationCallBack: () => Navigation.goBack(isQuickSettingsFlow ? ROUTES.SETTINGS_TAGS_ROOT.getRoute(policyID) : undefined),
    });

    const updateWorkspaceTagEnabled = useCallback(
        (value: boolean, tagName: string) => {
            setWorkspaceTagEnabled(policyID, {[tagName]: {name: tagName, enabled: value}}, route.params.orderWeight);
        },
        [policyID, route.params.orderWeight],
    );

    const tagList = useMemo<TagListItem[]>(
        () =>
            Object.values(currentPolicyTag?.tags ?? {})
                .sort((tagA, tagB) => localeCompare(tagA.name, tagB.name))
                .map((tag) => ({
                    value: tag.name,
                    text: getCleanedTagName(tag.name),
                    keyForList: tag.name,
                    isSelected: selectedTags[tag.name] && canSelectMultiple,
                    pendingAction: tag.pendingAction,
                    errors: tag.errors ?? undefined,
                    enabled: tag.enabled,
                    isDisabled: tag.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                    rightElement: (
                        <Switch
                            isOn={tag.enabled}
                            disabled={tag.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE}
                            accessibilityLabel={translate('workspace.tags.enableTag')}
                            onToggle={(newValue: boolean) => updateWorkspaceTagEnabled(newValue, tag.name)}
                        />
                    ),
                })),
        [currentPolicyTag?.tags, selectedTags, canSelectMultiple, translate, updateWorkspaceTagEnabled],
    );

    const hasDependentTags = useMemo(() => hasDependentTagsPolicyUtils(policy, policyTags), [policy, policyTags]);

    const tagListKeyedByName = useMemo(
        () =>
            tagList.reduce<Record<string, TagListItem>>((acc, tag) => {
                acc[tag.value] = tag;
                return acc;
            }, {}),
        [tagList],
    );

    if (!currentPolicyTag) {
        return <NotFoundPage />;
    }

    const toggleTag = (tag: TagListItem) => {
        setSelectedTags((prev) => ({
            ...prev,
            [tag.value]: !prev[tag.value],
        }));
    };

    const toggleAllTags = () => {
        const availableTags = tagList.filter((tag) => tag.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
        const anySelected = availableTags.some((tag) => !!selectedTags[tag.value]);

        setSelectedTags(anySelected ? {} : Object.fromEntries(availableTags.map((t) => [t.value, true])));
    };

    const getCustomListHeader = () => {
        return (
            <CustomListHeader
                canSelectMultiple={canSelectMultiple}
                leftHeaderText={translate('common.name')}
                rightHeaderText={translate('common.enabled')}
            />
        );
    };

    const navigateToTagSettings = (tag: TagListItem) => {
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAG_SETTINGS.getRoute(policyID, route.params.orderWeight, tag.value, backTo)
                : ROUTES.WORKSPACE_TAG_SETTINGS.getRoute(policyID, route.params.orderWeight, tag.value),
        );
    };

    const selectedTagsArray = Object.keys(selectedTags).filter((key) => selectedTags[key]);

    const deleteTags = () => {
        setSelectedTags({});
        deletePolicyTags(policyID, selectedTagsArray);
        setIsDeleteTagsConfirmModalVisible(false);
    };

    const isLoading = !isOffline && policyTags === undefined;

    const getHeaderButtons = () => {
        if ((!isSmallScreenWidth && selectedTagsArray.length === 0) || (isSmallScreenWidth && !selectionMode?.isEnabled)) {
            return null;
        }

        const options: Array<DropdownOption<DeepValueOf<typeof CONST.POLICY.BULK_ACTION_TYPES>>> = [];
        const isThereAnyAccountingConnection = Object.keys(policy?.connections ?? {}).length !== 0;
        const isMultiLevelTags = isMultiLevelTagsPolicyUtils(policyTags);

        if (!isThereAnyAccountingConnection && !isMultiLevelTags && selectedTagsArray.length > 0) {
            options.push({
                icon: Expensicons.Trashcan,
                text: translate(selectedTagsArray.length === 1 ? 'workspace.tags.deleteTag' : 'workspace.tags.deleteTags'),
                value: CONST.POLICY.BULK_ACTION_TYPES.DELETE,
                onSelected: () => setIsDeleteTagsConfirmModalVisible(true),
            });
        }

        let enabledTagCount = 0;
        const tagsToDisable: Record<string, {name: string; enabled: boolean}> = {};
        let disabledTagCount = 0;
        const tagsToEnable: Record<string, {name: string; enabled: boolean}> = {};
        for (const tagName of selectedTagsArray) {
            if (tagListKeyedByName[tagName]?.enabled) {
                enabledTagCount++;
                tagsToDisable[tagName] = {
                    name: tagName,
                    enabled: false,
                };
            } else {
                disabledTagCount++;
                tagsToEnable[tagName] = {
                    name: tagName,
                    enabled: true,
                };
            }
        }

        if (enabledTagCount > 0) {
            options.push({
                icon: Expensicons.Close,
                text: translate(enabledTagCount === 1 ? 'workspace.tags.disableTag' : 'workspace.tags.disableTags'),
                value: CONST.POLICY.BULK_ACTION_TYPES.DISABLE,
                onSelected: () => {
                    setSelectedTags({});
                    setWorkspaceTagEnabled(policyID, tagsToDisable, route.params.orderWeight);
                },
            });
        }

        if (disabledTagCount > 0) {
            options.push({
                icon: Expensicons.Checkmark,
                text: translate(disabledTagCount === 1 ? 'workspace.tags.enableTag' : 'workspace.tags.enableTags'),
                value: CONST.POLICY.BULK_ACTION_TYPES.ENABLE,
                onSelected: () => {
                    setSelectedTags({});
                    setWorkspaceTagEnabled(policyID, tagsToEnable, route.params.orderWeight);
                },
            });
        }

        return (
            <ButtonWithDropdownMenu
                buttonRef={dropdownButtonRef}
                onPress={() => null}
                shouldAlwaysShowDropdownMenu
                pressOnEnter
                isSplitButton={false}
                buttonSize={CONST.DROPDOWN_BUTTON_SIZE.MEDIUM}
                customText={translate('workspace.common.selected', {count: selectedTagsArray.length})}
                options={options}
                style={[shouldUseNarrowLayout && styles.flexGrow1, shouldUseNarrowLayout && styles.mb3]}
                isDisabled={!selectedTagsArray.length}
            />
        );
    };

    if (!!currentPolicyTag?.required && !Object.values(currentPolicyTag?.tags ?? {}).some((tag) => tag.enabled)) {
        setPolicyTagsRequired(policyID, false, route.params.orderWeight);
    }

    const navigateToEditTag = () => {
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAGS_EDIT.getRoute(route.params.policyID, currentPolicyTag?.orderWeight ?? 0, backTo)
                : ROUTES.WORKSPACE_EDIT_TAGS.getRoute(route.params.policyID, currentPolicyTag?.orderWeight ?? 0, Navigation.getActiveRoute()),
        );
    };

    const selectionModeHeader = selectionMode?.isEnabled && isSmallScreenWidth;

    return (
        <AccessOrNotFoundWrapper
            policyID={policyID}
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                shouldEnableMaxHeight
                testID={WorkspaceViewTagsPage.displayName}
            >
                <HeaderWithBackButton
                    title={selectionModeHeader ? translate('common.selectMultiple') : currentTagListName}
                    onBackButtonPress={() => {
                        if (selectionMode?.isEnabled) {
                            setSelectedTags({});
                            turnOffMobileSelectionMode();
                            return;
                        }
                        Navigation.goBack(isQuickSettingsFlow ? ROUTES.SETTINGS_TAGS_ROOT.getRoute(policyID) : undefined);
                    }}
                >
                    {!shouldUseNarrowLayout && getHeaderButtons()}
                </HeaderWithBackButton>
                {shouldUseNarrowLayout && <View style={[styles.pl5, styles.pr5]}>{getHeaderButtons()}</View>}
                <ConfirmModal
                    isVisible={isDeleteTagsConfirmModalVisible}
                    onConfirm={deleteTags}
                    onCancel={() => setIsDeleteTagsConfirmModalVisible(false)}
                    title={translate(selectedTagsArray.length === 1 ? 'workspace.tags.deleteTag' : 'workspace.tags.deleteTags')}
                    prompt={translate(selectedTagsArray.length === 1 ? 'workspace.tags.deleteTagConfirmation' : 'workspace.tags.deleteTagsConfirmation')}
                    confirmText={translate('common.delete')}
                    cancelText={translate('common.cancel')}
                    danger
                />
                {!hasDependentTags && (
                    <View style={[styles.pv4, styles.ph5]}>
                        <ToggleSettingOptionRow
                            title={translate('common.required')}
                            switchAccessibilityLabel={translate('common.required')}
                            isActive={!!currentPolicyTag?.required}
                            onToggle={(on) => setPolicyTagsRequired(policyID, on, route.params.orderWeight)}
                            pendingAction={currentPolicyTag.pendingFields?.required}
                            errors={currentPolicyTag?.errorFields?.required ?? undefined}
                            onCloseError={() => clearPolicyTagListErrorField(policyID, route.params.orderWeight, 'required')}
                            disabled={!currentPolicyTag?.required && !Object.values(currentPolicyTag?.tags ?? {}).some((tag) => tag.enabled)}
                        />
                    </View>
                )}
                <OfflineWithFeedback
                    errors={currentPolicyTag.errors}
                    onClose={() => clearPolicyTagListErrors(policyID, currentPolicyTag.orderWeight)}
                    pendingAction={currentPolicyTag.pendingAction}
                    errorRowStyles={styles.mh5}
                >
                    <MenuItemWithTopDescription
                        title={getCleanedTagName(currentPolicyTag.name)}
                        description={translate(`workspace.tags.customTagName`)}
                        onPress={navigateToEditTag}
                        shouldShowRightIcon
                    />
                </OfflineWithFeedback>
                {isLoading && (
                    <ActivityIndicator
                        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                        style={[styles.flex1]}
                        color={theme.spinner}
                    />
                )}
                {tagList.length > 0 && !isLoading && (
                    <SelectionListWithModal
                        canSelectMultiple={canSelectMultiple}
                        turnOnSelectionModeOnLongPress
                        onTurnOnSelectionMode={(item) => item && toggleTag(item)}
                        sections={[{data: tagList, isDisabled: false}]}
                        onCheckboxPress={toggleTag}
                        onSelectRow={navigateToTagSettings}
                        onSelectAll={toggleAllTags}
                        showScrollIndicator
                        ListItem={TableListItem}
                        customListHeader={getCustomListHeader()}
                        shouldPreventDefaultFocusOnSelectRow={!canUseTouchScreen()}
                        listHeaderWrapperStyle={[styles.ph9, styles.pv3, styles.pb5]}
                        addBottomSafeAreaPadding
                        onDismissError={(item) => {
                            clearPolicyTagErrors(policyID, item.value, route.params.orderWeight);
                        }}
                    />
                )}
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceViewTagsPage.displayName = 'WorkspaceViewTagsPage';

export default WorkspaceViewTagsPage;
