import { CruiserToken } from '../types/cruiser-token';
import { db } from '../util/db';
import { checksum } from '../util/util';

/**
 * Tokens must follow the following format:
 *
 * Api-Token: cruiser.01HRK9G4KY6TC6Y3YQ3MFQ9F78.<128 uppercase A-Z0-9 chars>
 */
export const ApiTokenMiddleware = (req, res, next) => {
    let [type, token] = (req.get("authorization") as string)?.split(' ');
    type = type.toLowerCase();

    if (type == "apitoken" || type == "api-token") {

        const [kind, pubKey, privKey] = token.split('.');

        // Tokens must follow the format defined above
        if (
            kind != 'cruiser' ||
            !pubKey ||
            !privKey ||
            pubKey.length != 26 ||
            privKey.length != 128
        )
            return next(401);


        db.select<CruiserToken>('api_tokens:`' + pubKey + '`')
            .then(([token]) => {
                if (!token) return next(401);

                const hash = checksum('sha256', privKey);
                if (token.hash != hash) return setTimeout(() => next(401), 3000);

                next();
            })
            .catch(err => next(err));
    }
    else {
        // Bad token format
        next({ status: 401, message: "Invalid token format" });
    }
}
