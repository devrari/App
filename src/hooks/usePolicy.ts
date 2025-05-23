import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';

function getPolicyIDOrDefault(policyID?: string) {
    if (!policyID || policyID === CONST.POLICY.OWNER_EMAIL_FAKE) {
        return '-1';
    }
    return policyID;
}

function usePolicy(policyID?: string) {
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${getPolicyIDOrDefault(policyID)}`);
    return policy;
}

export default usePolicy;
