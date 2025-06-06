import React, {useEffect, useState} from 'react';
import {Linking} from 'react-native';
import {RESULTS} from 'react-native-permissions';
import ConfirmModal from '@components/ConfirmModal';
import * as Illustrations from '@components/Icon/Illustrations';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {getLocationPermission, requestLocationPermission} from '@pages/iou/request/step/IOURequestStepScan/LocationPermission';
import type {LocationPermissionModalProps} from './types';

function LocationPermissionModal({startPermissionFlow, resetPermissionFlow, onDeny, onGrant, onInitialGetLocationCompleted}: LocationPermissionModalProps) {
    const [hasError, setHasError] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const styles = useThemeStyles();
    const {translate} = useLocalize();

    useEffect(() => {
        if (!startPermissionFlow) {
            return;
        }

        getLocationPermission().then((status) => {
            onInitialGetLocationCompleted?.();
            if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
                return onGrant();
            }

            setShowModal(true);
            setHasError(status === RESULTS.BLOCKED);
        });
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps -- We only want to run this effect when startPermissionFlow changes
    }, [startPermissionFlow]);

    const handledBlockedPermission = (cb: () => void) => () => {
        setIsLoading(true);
        if (hasError && Linking.openSettings) {
            Linking.openSettings();
            setShowModal(false);
            setHasError(false);
            resetPermissionFlow();
            return;
        }
        cb();
    };

    const grantLocationPermission = handledBlockedPermission(() => {
        requestLocationPermission()
            .then((status) => {
                if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
                    onGrant();
                } else if (status === RESULTS.BLOCKED) {
                    setHasError(true);
                    return;
                } else {
                    onDeny();
                }
                setShowModal(false);
                setHasError(false);
            })
            .finally(() => {
                setIsLoading(false);
            });
    });

    const skipLocationPermission = () => {
        onDeny();
        setShowModal(false);
        setHasError(false);
    };

    const closeModal = () => {
        setShowModal(false);
        resetPermissionFlow();
    };

    return (
        <ConfirmModal
            isVisible={showModal}
            onConfirm={grantLocationPermission}
            onCancel={skipLocationPermission}
            onBackdropPress={closeModal}
            confirmText={hasError ? translate('common.settings') : translate('common.continue')}
            cancelText={translate('common.notNow')}
            prompt={translate(hasError ? 'receipt.locationErrorMessage' : 'receipt.locationAccessMessage')}
            promptStyles={[styles.textLabelSupportingEmptyValue, styles.mb4]}
            title={translate(hasError ? 'receipt.locationErrorTitle' : 'receipt.locationAccessTitle')}
            titleContainerStyles={[styles.mt2, styles.mb0]}
            titleStyles={[styles.textHeadline]}
            iconSource={Illustrations.ReceiptLocationMarker}
            iconFill={false}
            iconWidth={140}
            iconHeight={120}
            shouldCenterIcon
            shouldReverseStackedButtons
            isConfirmLoading={isLoading}
        />
    );
}

LocationPermissionModal.displayName = 'LocationPermissionModal';

export default LocationPermissionModal;
