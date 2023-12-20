const inbuiltProps = {
    __version__: true,
    __id__: true,
    rowid: true,
};
exports.inbuiltProps = inbuiltProps;

exports.validCollection = function (path) {
    return (
        !/___/.test(path) &&
        /^[a-z][a-z_0-9]+(\/[a-z][a-z_0-9]+\/[a-z][a-z_0-9]+)*$/.test(path)
    );
};
/**
 * An indempotent function to convert prop strings to sql identifiers
 * __id__ => __id__
 * "hello ji" => '"___hello ji__"'
 * The function of '___' in the key is not fully understood.
 */
exports.clean = function clean(key, m) {
    if (m !== true) console.log(key, clean(key, true));
    return inbuiltProps[key] || key.startsWith('"___')
        ? key
        : /(?:^[^a-z_]|[^a-z0-9_])/.test(key)
        ? JSON.stringify(
              key.startsWith("___")
                  ? key
                  : "___" + key.replace(/\./g, "___") + "__"
          )
        : key.startsWith("___")
        ? key
        : "___" + key.replace(/\./g, "___") + "__";
};

exports.unflatten = function (data) {
    const obj = {};
    for (let key in data) {
        if (key.slice(0, 3) === "___") {
            let i = key.slice(3, -2);
            if (i.indexOf("___") > -1) {
                const path = i.split("___");
                let ctx = obj;
                for (let j = 0; j < path.length - 1; j++) {
                    ctx = ctx[path[j]] = {};
                }
                ctx[path[path.length - 1]] = data[key];
            } else {
                obj[i] = data[key];
            }
        } else obj[key] = data[key];
    }
    return obj;
};

function checkValid(key) {
    if (key.indexOf("___") > -1) {
        throw "Invalid key";
    }
}

exports.flatten = function flatten(data, prefix = "") {
    let c = {};
    for (let i in data) {
        checkValid(i);
        if (
            data[i] &&
            typeof data[i] === "object" &&
            !Array.isArray(data[i]) &&
            !data[i].__isUpdateValue__
        ) {
            c[prefix + i] = flatten(data[i], prefix + i + ".");
        } else {
            c[prefix + i] = data[i];
        }
    }
    // Writes written too frequently would trash this version system.
    // Could this be the origin of firebase 1s limit.
    if (!data.hasOwnProperty("__version__")) c.__version__ = Date.now();
    return c;
};
