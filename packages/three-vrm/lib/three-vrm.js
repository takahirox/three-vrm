/*!
 * @pixiv/three-vrm v0.6.4
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2021 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE_VRM = {}, global.THREE));
}(this, (function (exports, THREE) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () {
                            return e[k];
                        }
                    });
                }
            });
        }
        n['default'] = e;
        return Object.freeze(n);
    }

    var THREE__namespace = /*#__PURE__*/_interopNamespace(THREE);

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    // See: https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
    function disposeMaterial(material) {
        Object.keys(material).forEach((propertyName) => {
            const value = material[propertyName];
            if (value === null || value === void 0 ? void 0 : value.isTexture) {
                const texture = value;
                texture.dispose();
            }
        });
        material.dispose();
    }
    function dispose(object3D) {
        const geometry = object3D.geometry;
        if (geometry) {
            geometry.dispose();
        }
        const material = object3D.material;
        if (material) {
            if (Array.isArray(material)) {
                material.forEach((material) => disposeMaterial(material));
            }
            else if (material) {
                disposeMaterial(material);
            }
        }
    }
    function deepDispose(object3D) {
        object3D.traverse(dispose);
    }

    var VRMBlendShapeMaterialValueType;
    (function (VRMBlendShapeMaterialValueType) {
        VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["NUMBER"] = 0] = "NUMBER";
        VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["VECTOR2"] = 1] = "VECTOR2";
        VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["VECTOR3"] = 2] = "VECTOR3";
        VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["VECTOR4"] = 3] = "VECTOR4";
        VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["COLOR"] = 4] = "COLOR";
    })(VRMBlendShapeMaterialValueType || (VRMBlendShapeMaterialValueType = {}));
    const _v2 = new THREE__namespace.Vector2();
    const _v3$1 = new THREE__namespace.Vector3();
    const _v4 = new THREE__namespace.Vector4();
    const _color = new THREE__namespace.Color();
    // animationMixer の監視対象は、Scene の中に入っている必要がある。
    // そのため、表示オブジェクトではないけれど、Object3D を継承して Scene に投入できるようにする。
    class VRMBlendShapeGroup extends THREE__namespace.Object3D {
        constructor(expressionName) {
            super();
            this.weight = 0.0;
            this.isBinary = false;
            this._binds = [];
            this._materialValues = [];
            this.name = `BlendShapeController_${expressionName}`;
            // traverse 時の救済手段として Object3D ではないことを明示しておく
            this.type = 'BlendShapeController';
            // 表示目的のオブジェクトではないので、負荷軽減のために visible を false にしておく。
            // これにより、このインスタンスに対する毎フレームの matrix 自動計算を省略できる。
            this.visible = false;
        }
        addBind(args) {
            // original weight is 0-100 but we want to deal with this value within 0-1
            const weight = args.weight / 100;
            this._binds.push({
                meshes: args.meshes,
                morphTargetIndex: args.morphTargetIndex,
                weight,
            });
        }
        addMaterialValue(args) {
            const material = args.material;
            const propertyName = args.propertyName;
            let value = material[propertyName];
            if (!value) {
                // property has not been found
                return;
            }
            value = args.defaultValue || value;
            let type;
            let defaultValue;
            let targetValue;
            let deltaValue;
            if (value.isVector2) {
                type = VRMBlendShapeMaterialValueType.VECTOR2;
                defaultValue = value.clone();
                targetValue = new THREE__namespace.Vector2().fromArray(args.targetValue);
                deltaValue = targetValue.clone().sub(defaultValue);
            }
            else if (value.isVector3) {
                type = VRMBlendShapeMaterialValueType.VECTOR3;
                defaultValue = value.clone();
                targetValue = new THREE__namespace.Vector3().fromArray(args.targetValue);
                deltaValue = targetValue.clone().sub(defaultValue);
            }
            else if (value.isVector4) {
                type = VRMBlendShapeMaterialValueType.VECTOR4;
                defaultValue = value.clone();
                // vectorProperty and targetValue index is different from each other
                // exported vrm by UniVRM file is
                //
                // vectorProperty
                // offset = targetValue[0], targetValue[1]
                // tiling = targetValue[2], targetValue[3]
                //
                // targetValue
                // offset = targetValue[2], targetValue[3]
                // tiling = targetValue[0], targetValue[1]
                targetValue = new THREE__namespace.Vector4().fromArray([
                    args.targetValue[2],
                    args.targetValue[3],
                    args.targetValue[0],
                    args.targetValue[1],
                ]);
                deltaValue = targetValue.clone().sub(defaultValue);
            }
            else if (value.isColor) {
                type = VRMBlendShapeMaterialValueType.COLOR;
                defaultValue = value.clone();
                targetValue = new THREE__namespace.Color().fromArray(args.targetValue);
                deltaValue = targetValue.clone().sub(defaultValue);
            }
            else {
                type = VRMBlendShapeMaterialValueType.NUMBER;
                defaultValue = value;
                targetValue = args.targetValue[0];
                deltaValue = targetValue - defaultValue;
            }
            this._materialValues.push({
                material,
                propertyName,
                defaultValue,
                targetValue,
                deltaValue,
                type,
            });
        }
        /**
         * Apply weight to every assigned blend shapes.
         * Should be called via {@link BlendShapeMaster#update}.
         */
        applyWeight() {
            const w = this.isBinary ? (this.weight < 0.5 ? 0.0 : 1.0) : this.weight;
            this._binds.forEach((bind) => {
                bind.meshes.forEach((mesh) => {
                    if (!mesh.morphTargetInfluences) {
                        return;
                    } // TODO: we should kick this at `addBind`
                    mesh.morphTargetInfluences[bind.morphTargetIndex] += w * bind.weight;
                });
            });
            this._materialValues.forEach((materialValue) => {
                const prop = materialValue.material[materialValue.propertyName];
                if (prop === undefined) {
                    return;
                } // TODO: we should kick this at `addMaterialValue`
                if (materialValue.type === VRMBlendShapeMaterialValueType.NUMBER) {
                    const deltaValue = materialValue.deltaValue;
                    materialValue.material[materialValue.propertyName] += deltaValue * w;
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR2) {
                    const deltaValue = materialValue.deltaValue;
                    materialValue.material[materialValue.propertyName].add(_v2.copy(deltaValue).multiplyScalar(w));
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR3) {
                    const deltaValue = materialValue.deltaValue;
                    materialValue.material[materialValue.propertyName].add(_v3$1.copy(deltaValue).multiplyScalar(w));
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR4) {
                    const deltaValue = materialValue.deltaValue;
                    materialValue.material[materialValue.propertyName].add(_v4.copy(deltaValue).multiplyScalar(w));
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.COLOR) {
                    const deltaValue = materialValue.deltaValue;
                    materialValue.material[materialValue.propertyName].add(_color.copy(deltaValue).multiplyScalar(w));
                }
                if (typeof materialValue.material.shouldApplyUniforms === 'boolean') {
                    materialValue.material.shouldApplyUniforms = true;
                }
            });
        }
        /**
         * Clear previously assigned blend shapes.
         */
        clearAppliedWeight() {
            this._binds.forEach((bind) => {
                bind.meshes.forEach((mesh) => {
                    if (!mesh.morphTargetInfluences) {
                        return;
                    } // TODO: we should kick this at `addBind`
                    mesh.morphTargetInfluences[bind.morphTargetIndex] = 0.0;
                });
            });
            this._materialValues.forEach((materialValue) => {
                const prop = materialValue.material[materialValue.propertyName];
                if (prop === undefined) {
                    return;
                } // TODO: we should kick this at `addMaterialValue`
                if (materialValue.type === VRMBlendShapeMaterialValueType.NUMBER) {
                    const defaultValue = materialValue.defaultValue;
                    materialValue.material[materialValue.propertyName] = defaultValue;
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR2) {
                    const defaultValue = materialValue.defaultValue;
                    materialValue.material[materialValue.propertyName].copy(defaultValue);
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR3) {
                    const defaultValue = materialValue.defaultValue;
                    materialValue.material[materialValue.propertyName].copy(defaultValue);
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR4) {
                    const defaultValue = materialValue.defaultValue;
                    materialValue.material[materialValue.propertyName].copy(defaultValue);
                }
                else if (materialValue.type === VRMBlendShapeMaterialValueType.COLOR) {
                    const defaultValue = materialValue.defaultValue;
                    materialValue.material[materialValue.propertyName].copy(defaultValue);
                }
                if (typeof materialValue.material.shouldApplyUniforms === 'boolean') {
                    materialValue.material.shouldApplyUniforms = true;
                }
            });
        }
    }

    // Typedoc does not support export declarations yet
    // then we have to use `namespace` instead of export declarations for now.
    // See: https://github.com/TypeStrong/typedoc/pull/801
    // eslint-disable-next-line @typescript-eslint/no-namespace
    exports.VRMSchema = void 0;
    (function (VRMSchema) {
        (function (BlendShapePresetName) {
            BlendShapePresetName["A"] = "a";
            BlendShapePresetName["Angry"] = "angry";
            BlendShapePresetName["Blink"] = "blink";
            BlendShapePresetName["BlinkL"] = "blink_l";
            BlendShapePresetName["BlinkR"] = "blink_r";
            BlendShapePresetName["E"] = "e";
            BlendShapePresetName["Fun"] = "fun";
            BlendShapePresetName["I"] = "i";
            BlendShapePresetName["Joy"] = "joy";
            BlendShapePresetName["Lookdown"] = "lookdown";
            BlendShapePresetName["Lookleft"] = "lookleft";
            BlendShapePresetName["Lookright"] = "lookright";
            BlendShapePresetName["Lookup"] = "lookup";
            BlendShapePresetName["Neutral"] = "neutral";
            BlendShapePresetName["O"] = "o";
            BlendShapePresetName["Sorrow"] = "sorrow";
            BlendShapePresetName["U"] = "u";
            BlendShapePresetName["Unknown"] = "unknown";
        })(VRMSchema.BlendShapePresetName || (VRMSchema.BlendShapePresetName = {}));
        (function (FirstPersonLookAtTypeName) {
            FirstPersonLookAtTypeName["BlendShape"] = "BlendShape";
            FirstPersonLookAtTypeName["Bone"] = "Bone";
        })(VRMSchema.FirstPersonLookAtTypeName || (VRMSchema.FirstPersonLookAtTypeName = {}));
        (function (HumanoidBoneName) {
            HumanoidBoneName["Chest"] = "chest";
            HumanoidBoneName["Head"] = "head";
            HumanoidBoneName["Hips"] = "hips";
            HumanoidBoneName["Jaw"] = "jaw";
            HumanoidBoneName["LeftEye"] = "leftEye";
            HumanoidBoneName["LeftFoot"] = "leftFoot";
            HumanoidBoneName["LeftHand"] = "leftHand";
            HumanoidBoneName["LeftIndexDistal"] = "leftIndexDistal";
            HumanoidBoneName["LeftIndexIntermediate"] = "leftIndexIntermediate";
            HumanoidBoneName["LeftIndexProximal"] = "leftIndexProximal";
            HumanoidBoneName["LeftLittleDistal"] = "leftLittleDistal";
            HumanoidBoneName["LeftLittleIntermediate"] = "leftLittleIntermediate";
            HumanoidBoneName["LeftLittleProximal"] = "leftLittleProximal";
            HumanoidBoneName["LeftLowerArm"] = "leftLowerArm";
            HumanoidBoneName["LeftLowerLeg"] = "leftLowerLeg";
            HumanoidBoneName["LeftMiddleDistal"] = "leftMiddleDistal";
            HumanoidBoneName["LeftMiddleIntermediate"] = "leftMiddleIntermediate";
            HumanoidBoneName["LeftMiddleProximal"] = "leftMiddleProximal";
            HumanoidBoneName["LeftRingDistal"] = "leftRingDistal";
            HumanoidBoneName["LeftRingIntermediate"] = "leftRingIntermediate";
            HumanoidBoneName["LeftRingProximal"] = "leftRingProximal";
            HumanoidBoneName["LeftShoulder"] = "leftShoulder";
            HumanoidBoneName["LeftThumbDistal"] = "leftThumbDistal";
            HumanoidBoneName["LeftThumbIntermediate"] = "leftThumbIntermediate";
            HumanoidBoneName["LeftThumbProximal"] = "leftThumbProximal";
            HumanoidBoneName["LeftToes"] = "leftToes";
            HumanoidBoneName["LeftUpperArm"] = "leftUpperArm";
            HumanoidBoneName["LeftUpperLeg"] = "leftUpperLeg";
            HumanoidBoneName["Neck"] = "neck";
            HumanoidBoneName["RightEye"] = "rightEye";
            HumanoidBoneName["RightFoot"] = "rightFoot";
            HumanoidBoneName["RightHand"] = "rightHand";
            HumanoidBoneName["RightIndexDistal"] = "rightIndexDistal";
            HumanoidBoneName["RightIndexIntermediate"] = "rightIndexIntermediate";
            HumanoidBoneName["RightIndexProximal"] = "rightIndexProximal";
            HumanoidBoneName["RightLittleDistal"] = "rightLittleDistal";
            HumanoidBoneName["RightLittleIntermediate"] = "rightLittleIntermediate";
            HumanoidBoneName["RightLittleProximal"] = "rightLittleProximal";
            HumanoidBoneName["RightLowerArm"] = "rightLowerArm";
            HumanoidBoneName["RightLowerLeg"] = "rightLowerLeg";
            HumanoidBoneName["RightMiddleDistal"] = "rightMiddleDistal";
            HumanoidBoneName["RightMiddleIntermediate"] = "rightMiddleIntermediate";
            HumanoidBoneName["RightMiddleProximal"] = "rightMiddleProximal";
            HumanoidBoneName["RightRingDistal"] = "rightRingDistal";
            HumanoidBoneName["RightRingIntermediate"] = "rightRingIntermediate";
            HumanoidBoneName["RightRingProximal"] = "rightRingProximal";
            HumanoidBoneName["RightShoulder"] = "rightShoulder";
            HumanoidBoneName["RightThumbDistal"] = "rightThumbDistal";
            HumanoidBoneName["RightThumbIntermediate"] = "rightThumbIntermediate";
            HumanoidBoneName["RightThumbProximal"] = "rightThumbProximal";
            HumanoidBoneName["RightToes"] = "rightToes";
            HumanoidBoneName["RightUpperArm"] = "rightUpperArm";
            HumanoidBoneName["RightUpperLeg"] = "rightUpperLeg";
            HumanoidBoneName["Spine"] = "spine";
            HumanoidBoneName["UpperChest"] = "upperChest";
        })(VRMSchema.HumanoidBoneName || (VRMSchema.HumanoidBoneName = {}));
        (function (MetaAllowedUserName) {
            MetaAllowedUserName["Everyone"] = "Everyone";
            MetaAllowedUserName["ExplicitlyLicensedPerson"] = "ExplicitlyLicensedPerson";
            MetaAllowedUserName["OnlyAuthor"] = "OnlyAuthor";
        })(VRMSchema.MetaAllowedUserName || (VRMSchema.MetaAllowedUserName = {}));
        (function (MetaUssageName) {
            MetaUssageName["Allow"] = "Allow";
            MetaUssageName["Disallow"] = "Disallow";
        })(VRMSchema.MetaUssageName || (VRMSchema.MetaUssageName = {}));
        (function (MetaLicenseName) {
            MetaLicenseName["Cc0"] = "CC0";
            MetaLicenseName["CcBy"] = "CC_BY";
            MetaLicenseName["CcByNc"] = "CC_BY_NC";
            MetaLicenseName["CcByNcNd"] = "CC_BY_NC_ND";
            MetaLicenseName["CcByNcSa"] = "CC_BY_NC_SA";
            MetaLicenseName["CcByNd"] = "CC_BY_ND";
            MetaLicenseName["CcBySa"] = "CC_BY_SA";
            MetaLicenseName["Other"] = "Other";
            MetaLicenseName["RedistributionProhibited"] = "Redistribution_Prohibited";
        })(VRMSchema.MetaLicenseName || (VRMSchema.MetaLicenseName = {}));
    })(exports.VRMSchema || (exports.VRMSchema = {}));

    function extractPrimitivesInternal(gltf, nodeIndex, node) {
        /**
         * Let's list up every possible patterns that parsed gltf nodes with a mesh can have,,,
         *
         * "*" indicates that those meshes should be listed up using this function
         *
         * ### A node with a (mesh, a signle primitive)
         *
         * - `THREE.Mesh`: The only primitive of the mesh *
         *
         * ### A node with a (mesh, multiple primitives)
         *
         * - `THREE.Group`: The root of the mesh
         *   - `THREE.Mesh`: A primitive of the mesh *
         *   - `THREE.Mesh`: A primitive of the mesh (2) *
         *
         * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, a single primitive)
         *
         * - `THREE.Group`: The root of the mesh
         *   - `THREE.Mesh`: A primitive of the mesh *
         *   - `THREE.Mesh`: A primitive of the mesh (2) *
         *   - `THREE.Mesh`: A primitive of a MESH OF THE CHILD
         *
         * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, multiple primitives)
         *
         * - `THREE.Group`: The root of the mesh
         *   - `THREE.Mesh`: A primitive of the mesh *
         *   - `THREE.Mesh`: A primitive of the mesh (2) *
         *   - `THREE.Group`: The root of a MESH OF THE CHILD
         *     - `THREE.Mesh`: A primitive of the mesh of the child
         *     - `THREE.Mesh`: A primitive of the mesh of the child (2)
         *
         * ### A node with a (mesh, multiple primitives) BUT the node is a bone
         *
         * - `THREE.Bone`: The root of the node, as a bone
         *   - `THREE.Group`: The root of the mesh
         *     - `THREE.Mesh`: A primitive of the mesh *
         *     - `THREE.Mesh`: A primitive of the mesh (2) *
         *
         * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, multiple primitives) BUT the node is a bone
         *
         * - `THREE.Bone`: The root of the node, as a bone
         *   - `THREE.Group`: The root of the mesh
         *     - `THREE.Mesh`: A primitive of the mesh *
         *     - `THREE.Mesh`: A primitive of the mesh (2) *
         *   - `THREE.Group`: The root of a MESH OF THE CHILD
         *     - `THREE.Mesh`: A primitive of the mesh of the child
         *     - `THREE.Mesh`: A primitive of the mesh of the child (2)
         *
         * ...I will take a strategy that traverses the root of the node and take first (primitiveCount) meshes.
         */
        // Make sure that the node has a mesh
        const schemaNode = gltf.parser.json.nodes[nodeIndex];
        const meshIndex = schemaNode.mesh;
        if (meshIndex == null) {
            return null;
        }
        // How many primitives the mesh has?
        const schemaMesh = gltf.parser.json.meshes[meshIndex];
        const primitiveCount = schemaMesh.primitives.length;
        // Traverse the node and take first (primitiveCount) meshes
        const primitives = [];
        node.traverse((object) => {
            if (primitives.length < primitiveCount) {
                if (object.isMesh) {
                    primitives.push(object);
                }
            }
        });
        return primitives;
    }
    /**
     * Extract primitives ( `THREE.Mesh[]` ) of a node from a loaded GLTF.
     * The main purpose of this function is to distinguish primitives and children from a node that has both meshes and children.
     *
     * It utilizes the behavior that GLTFLoader adds mesh primitives to the node object ( `THREE.Group` ) first then adds its children.
     *
     * @param gltf A GLTF object taken from GLTFLoader
     * @param nodeIndex The index of the node
     */
    function gltfExtractPrimitivesFromNode(gltf, nodeIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const node = yield gltf.parser.getDependency('node', nodeIndex);
            return extractPrimitivesInternal(gltf, nodeIndex, node);
        });
    }
    /**
     * Extract primitives ( `THREE.Mesh[]` ) of nodes from a loaded GLTF.
     * See {@link gltfExtractPrimitivesFromNode} for more details.
     *
     * It returns a map from node index to extraction result.
     * If a node does not have a mesh, the entry for the node will not be put in the returning map.
     *
     * @param gltf A GLTF object taken from GLTFLoader
     */
    function gltfExtractPrimitivesFromNodes(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodes = yield gltf.parser.getDependencies('node');
            const map = new Map();
            nodes.forEach((node, index) => {
                const result = extractPrimitivesInternal(gltf, index, node);
                if (result != null) {
                    map.set(index, result);
                }
            });
            return map;
        });
    }

    function renameMaterialProperty(name) {
        if (name[0] !== '_') {
            console.warn(`renameMaterialProperty: Given property name "${name}" might be invalid`);
            return name;
        }
        name = name.substring(1);
        if (!/[A-Z]/.test(name[0])) {
            console.warn(`renameMaterialProperty: Given property name "${name}" might be invalid`);
            return name;
        }
        return name[0].toLowerCase() + name.substring(1);
    }

    /**
     * Clamp an input number within [ `0.0` - `1.0` ].
     *
     * @param value The input value
     */
    function saturate(value) {
        return Math.max(Math.min(value, 1.0), 0.0);
    }
    const _position = new THREE__namespace.Vector3();
    const _scale = new THREE__namespace.Vector3();
    new THREE__namespace.Quaternion();
    /**
     * Extract world rotation of an object from its world space matrix, in cheaper way.
     *
     * @param object The object
     * @param out Target vector
     */
    function getWorldQuaternionLite(object, out) {
        object.matrixWorld.decompose(_position, out, _scale);
        return out;
    }

    class VRMBlendShapeProxy {
        /**
         * Create a new VRMBlendShape.
         */
        constructor() {
            /**
             * List of registered blend shape.
             */
            this._blendShapeGroups = {};
            /**
             * A map from [[VRMSchema.BlendShapePresetName]] to its actual blend shape name.
             */
            this._blendShapePresetMap = {};
            /**
             * A list of name of unknown blend shapes.
             */
            this._unknownGroupNames = [];
            // do nothing
        }
        /**
         * List of name of registered blend shape group.
         */
        get expressions() {
            return Object.keys(this._blendShapeGroups);
        }
        /**
         * A map from [[VRMSchema.BlendShapePresetName]] to its actual blend shape name.
         */
        get blendShapePresetMap() {
            return this._blendShapePresetMap;
        }
        /**
         * A list of name of unknown blend shapes.
         */
        get unknownGroupNames() {
            return this._unknownGroupNames;
        }
        /**
         * Return registered blend shape group.
         *
         * @param name Name of the blend shape group
         */
        getBlendShapeGroup(name) {
            const presetName = this._blendShapePresetMap[name];
            const controller = presetName ? this._blendShapeGroups[presetName] : this._blendShapeGroups[name];
            if (!controller) {
                console.warn(`no blend shape found by ${name}`);
                return undefined;
            }
            return controller;
        }
        /**
         * Register a blend shape group.
         *
         * @param name Name of the blend shape gorup
         * @param controller VRMBlendShapeController that describes the blend shape group
         */
        registerBlendShapeGroup(name, presetName, controller) {
            this._blendShapeGroups[name] = controller;
            if (presetName) {
                this._blendShapePresetMap[presetName] = name;
            }
            else {
                this._unknownGroupNames.push(name);
            }
        }
        /**
         * Get current weight of specified blend shape group.
         *
         * @param name Name of the blend shape group
         */
        getValue(name) {
            var _a;
            const controller = this.getBlendShapeGroup(name);
            return (_a = controller === null || controller === void 0 ? void 0 : controller.weight) !== null && _a !== void 0 ? _a : null;
        }
        /**
         * Set a weight to specified blend shape group.
         *
         * @param name Name of the blend shape group
         * @param weight Weight
         */
        setValue(name, weight) {
            const controller = this.getBlendShapeGroup(name);
            if (controller) {
                controller.weight = saturate(weight);
            }
        }
        /**
         * Get a track name of specified blend shape group.
         * This track name is needed to manipulate its blend shape group via keyframe animations.
         *
         * @example Manipulate a blend shape group using keyframe animation
         * ```js
         * const trackName = vrm.blendShapeProxy.getBlendShapeTrackName( THREE.VRMSchema.BlendShapePresetName.Blink );
         * const track = new THREE.NumberKeyframeTrack(
         *   name,
         *   [ 0.0, 0.5, 1.0 ], // times
         *   [ 0.0, 1.0, 0.0 ] // values
         * );
         *
         * const clip = new THREE.AnimationClip(
         *   'blink', // name
         *   1.0, // duration
         *   [ track ] // tracks
         * );
         *
         * const mixer = new THREE.AnimationMixer( vrm.scene );
         * const action = mixer.clipAction( clip );
         * action.play();
         * ```
         *
         * @param name Name of the blend shape group
         */
        getBlendShapeTrackName(name) {
            const controller = this.getBlendShapeGroup(name);
            return controller ? `${controller.name}.weight` : null;
        }
        /**
         * Update every blend shape groups.
         */
        update() {
            Object.keys(this._blendShapeGroups).forEach((name) => {
                const controller = this._blendShapeGroups[name];
                controller.clearAppliedWeight();
            });
            Object.keys(this._blendShapeGroups).forEach((name) => {
                const controller = this._blendShapeGroups[name];
                controller.applyWeight();
            });
        }
    }

    /**
     * An importer that imports a [[VRMBlendShape]] from a VRM extension of a GLTF.
     */
    class VRMBlendShapeImporter {
        /**
         * Import a [[VRMBlendShape]] from a VRM.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         */
        import(gltf) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt) {
                    return null;
                }
                const schemaBlendShape = vrmExt.blendShapeMaster;
                if (!schemaBlendShape) {
                    return null;
                }
                const blendShape = new VRMBlendShapeProxy();
                const blendShapeGroups = schemaBlendShape.blendShapeGroups;
                if (!blendShapeGroups) {
                    return blendShape;
                }
                const blendShapePresetMap = {};
                yield Promise.all(blendShapeGroups.map((schemaGroup) => __awaiter(this, void 0, void 0, function* () {
                    const name = schemaGroup.name;
                    if (name === undefined) {
                        console.warn('VRMBlendShapeImporter: One of blendShapeGroups has no name');
                        return;
                    }
                    let presetName;
                    if (schemaGroup.presetName &&
                        schemaGroup.presetName !== exports.VRMSchema.BlendShapePresetName.Unknown &&
                        !blendShapePresetMap[schemaGroup.presetName]) {
                        presetName = schemaGroup.presetName;
                        blendShapePresetMap[schemaGroup.presetName] = name;
                    }
                    const group = new VRMBlendShapeGroup(name);
                    gltf.scene.add(group);
                    group.isBinary = schemaGroup.isBinary || false;
                    if (schemaGroup.binds) {
                        schemaGroup.binds.forEach((bind) => __awaiter(this, void 0, void 0, function* () {
                            if (bind.mesh === undefined || bind.index === undefined) {
                                return;
                            }
                            const nodesUsingMesh = [];
                            gltf.parser.json.nodes.forEach((node, i) => {
                                if (node.mesh === bind.mesh) {
                                    nodesUsingMesh.push(i);
                                }
                            });
                            const morphTargetIndex = bind.index;
                            yield Promise.all(nodesUsingMesh.map((nodeIndex) => __awaiter(this, void 0, void 0, function* () {
                                var _b;
                                const primitives = (yield gltfExtractPrimitivesFromNode(gltf, nodeIndex));
                                // check if the mesh has the target morph target
                                if (!primitives.every((primitive) => Array.isArray(primitive.morphTargetInfluences) &&
                                    morphTargetIndex < primitive.morphTargetInfluences.length)) {
                                    console.warn(`VRMBlendShapeImporter: ${schemaGroup.name} attempts to index ${morphTargetIndex}th morph but not found.`);
                                    return;
                                }
                                group.addBind({
                                    meshes: primitives,
                                    morphTargetIndex,
                                    weight: (_b = bind.weight) !== null && _b !== void 0 ? _b : 100,
                                });
                            })));
                        }));
                    }
                    const materialValues = schemaGroup.materialValues;
                    if (materialValues) {
                        materialValues.forEach((materialValue) => {
                            if (materialValue.materialName === undefined ||
                                materialValue.propertyName === undefined ||
                                materialValue.targetValue === undefined) {
                                return;
                            }
                            const materials = [];
                            gltf.scene.traverse((object) => {
                                if (object.material) {
                                    const material = object.material;
                                    if (Array.isArray(material)) {
                                        materials.push(...material.filter((mtl) => mtl.name === materialValue.materialName && materials.indexOf(mtl) === -1));
                                    }
                                    else if (material.name === materialValue.materialName && materials.indexOf(material) === -1) {
                                        materials.push(material);
                                    }
                                }
                            });
                            materials.forEach((material) => {
                                group.addMaterialValue({
                                    material,
                                    propertyName: renameMaterialProperty(materialValue.propertyName),
                                    targetValue: materialValue.targetValue,
                                });
                            });
                        });
                    }
                    blendShape.registerBlendShapeGroup(name, presetName, group);
                })));
                return blendShape;
            });
        }
    }

    const VECTOR3_FRONT$1 = Object.freeze(new THREE__namespace.Vector3(0.0, 0.0, -1.0));
    const _quat$1 = new THREE__namespace.Quaternion();
    var FirstPersonFlag;
    (function (FirstPersonFlag) {
        FirstPersonFlag[FirstPersonFlag["Auto"] = 0] = "Auto";
        FirstPersonFlag[FirstPersonFlag["Both"] = 1] = "Both";
        FirstPersonFlag[FirstPersonFlag["ThirdPersonOnly"] = 2] = "ThirdPersonOnly";
        FirstPersonFlag[FirstPersonFlag["FirstPersonOnly"] = 3] = "FirstPersonOnly";
    })(FirstPersonFlag || (FirstPersonFlag = {}));
    /**
     * This class represents a single [`meshAnnotation`](https://github.com/vrm-c/UniVRM/blob/master/specification/0.0/schema/vrm.firstperson.meshannotation.schema.json) entry.
     * Each mesh will be assigned to specified layer when you call [[VRMFirstPerson.setup]].
     */
    class VRMRendererFirstPersonFlags {
        /**
         * Create a new mesh annotation.
         *
         * @param firstPersonFlag A [[FirstPersonFlag]] of the annotation entry
         * @param node A node of the annotation entry.
         */
        constructor(firstPersonFlag, primitives) {
            this.firstPersonFlag = VRMRendererFirstPersonFlags._parseFirstPersonFlag(firstPersonFlag);
            this.primitives = primitives;
        }
        static _parseFirstPersonFlag(firstPersonFlag) {
            switch (firstPersonFlag) {
                case 'Both':
                    return FirstPersonFlag.Both;
                case 'ThirdPersonOnly':
                    return FirstPersonFlag.ThirdPersonOnly;
                case 'FirstPersonOnly':
                    return FirstPersonFlag.FirstPersonOnly;
                default:
                    return FirstPersonFlag.Auto;
            }
        }
    }
    class VRMFirstPerson {
        /**
         * Create a new VRMFirstPerson object.
         *
         * @param firstPersonBone A first person bone
         * @param firstPersonBoneOffset An offset from the specified first person bone
         * @param meshAnnotations A renderer settings. See the description of [[RendererFirstPersonFlags]] for more info
         */
        constructor(firstPersonBone, firstPersonBoneOffset, meshAnnotations) {
            this._meshAnnotations = [];
            this._firstPersonOnlyLayer = VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER;
            this._thirdPersonOnlyLayer = VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER;
            this._initialized = false;
            this._firstPersonBone = firstPersonBone;
            this._firstPersonBoneOffset = firstPersonBoneOffset;
            this._meshAnnotations = meshAnnotations;
        }
        get firstPersonBone() {
            return this._firstPersonBone;
        }
        get meshAnnotations() {
            return this._meshAnnotations;
        }
        getFirstPersonWorldDirection(target) {
            return target.copy(VECTOR3_FRONT$1).applyQuaternion(getWorldQuaternionLite(this._firstPersonBone, _quat$1));
        }
        /**
         * A camera layer represents `FirstPersonOnly` layer.
         * Note that **you must call [[setup]] first before you use the layer feature** or it does not work properly.
         *
         * The value is [[DEFAULT_FIRSTPERSON_ONLY_LAYER]] by default but you can change the layer by specifying via [[setup]] if you prefer.
         *
         * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
         * @see https://threejs.org/docs/#api/en/core/Layers
         */
        get firstPersonOnlyLayer() {
            return this._firstPersonOnlyLayer;
        }
        /**
         * A camera layer represents `ThirdPersonOnly` layer.
         * Note that **you must call [[setup]] first before you use the layer feature** or it does not work properly.
         *
         * The value is [[DEFAULT_THIRDPERSON_ONLY_LAYER]] by default but you can change the layer by specifying via [[setup]] if you prefer.
         *
         * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
         * @see https://threejs.org/docs/#api/en/core/Layers
         */
        get thirdPersonOnlyLayer() {
            return this._thirdPersonOnlyLayer;
        }
        getFirstPersonBoneOffset(target) {
            return target.copy(this._firstPersonBoneOffset);
        }
        /**
         * Get current world position of the first person.
         * The position takes [[FirstPersonBone]] and [[FirstPersonOffset]] into account.
         *
         * @param v3 target
         * @returns Current world position of the first person
         */
        getFirstPersonWorldPosition(v3) {
            // UniVRM#VRMFirstPersonEditor
            // var worldOffset = head.localToWorldMatrix.MultiplyPoint(component.FirstPersonOffset);
            const offset = this._firstPersonBoneOffset;
            const v4 = new THREE__namespace.Vector4(offset.x, offset.y, offset.z, 1.0);
            v4.applyMatrix4(this._firstPersonBone.matrixWorld);
            return v3.set(v4.x, v4.y, v4.z);
        }
        /**
         * In this method, it assigns layers for every meshes based on mesh annotations.
         * You must call this method first before you use the layer feature.
         *
         * This is an equivalent of [VRMFirstPerson.Setup](https://github.com/vrm-c/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/FirstPerson/VRMFirstPerson.cs) of the UniVRM.
         *
         * The `cameraLayer` parameter specifies which layer will be assigned for `FirstPersonOnly` / `ThirdPersonOnly`.
         * In UniVRM, we specified those by naming each desired layer as `FIRSTPERSON_ONLY_LAYER` / `THIRDPERSON_ONLY_LAYER`
         * but we are going to specify these layers at here since we are unable to name layers in Three.js.
         *
         * @param cameraLayer Specify which layer will be for `FirstPersonOnly` / `ThirdPersonOnly`.
         */
        setup({ firstPersonOnlyLayer = VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER, thirdPersonOnlyLayer = VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER, } = {}) {
            if (this._initialized) {
                return;
            }
            this._initialized = true;
            this._firstPersonOnlyLayer = firstPersonOnlyLayer;
            this._thirdPersonOnlyLayer = thirdPersonOnlyLayer;
            this._meshAnnotations.forEach((item) => {
                if (item.firstPersonFlag === FirstPersonFlag.FirstPersonOnly) {
                    item.primitives.forEach((primitive) => {
                        primitive.layers.set(this._firstPersonOnlyLayer);
                    });
                }
                else if (item.firstPersonFlag === FirstPersonFlag.ThirdPersonOnly) {
                    item.primitives.forEach((primitive) => {
                        primitive.layers.set(this._thirdPersonOnlyLayer);
                    });
                }
                else if (item.firstPersonFlag === FirstPersonFlag.Auto) {
                    this._createHeadlessModel(item.primitives);
                }
            });
        }
        _excludeTriangles(triangles, bws, skinIndex, exclude) {
            let count = 0;
            if (bws != null && bws.length > 0) {
                for (let i = 0; i < triangles.length; i += 3) {
                    const a = triangles[i];
                    const b = triangles[i + 1];
                    const c = triangles[i + 2];
                    const bw0 = bws[a];
                    const skin0 = skinIndex[a];
                    if (bw0[0] > 0 && exclude.includes(skin0[0]))
                        continue;
                    if (bw0[1] > 0 && exclude.includes(skin0[1]))
                        continue;
                    if (bw0[2] > 0 && exclude.includes(skin0[2]))
                        continue;
                    if (bw0[3] > 0 && exclude.includes(skin0[3]))
                        continue;
                    const bw1 = bws[b];
                    const skin1 = skinIndex[b];
                    if (bw1[0] > 0 && exclude.includes(skin1[0]))
                        continue;
                    if (bw1[1] > 0 && exclude.includes(skin1[1]))
                        continue;
                    if (bw1[2] > 0 && exclude.includes(skin1[2]))
                        continue;
                    if (bw1[3] > 0 && exclude.includes(skin1[3]))
                        continue;
                    const bw2 = bws[c];
                    const skin2 = skinIndex[c];
                    if (bw2[0] > 0 && exclude.includes(skin2[0]))
                        continue;
                    if (bw2[1] > 0 && exclude.includes(skin2[1]))
                        continue;
                    if (bw2[2] > 0 && exclude.includes(skin2[2]))
                        continue;
                    if (bw2[3] > 0 && exclude.includes(skin2[3]))
                        continue;
                    triangles[count++] = a;
                    triangles[count++] = b;
                    triangles[count++] = c;
                }
            }
            return count;
        }
        _createErasedMesh(src, erasingBonesIndex) {
            const dst = new THREE__namespace.SkinnedMesh(src.geometry.clone(), src.material);
            dst.name = `${src.name}(erase)`;
            dst.frustumCulled = src.frustumCulled;
            dst.layers.set(this._firstPersonOnlyLayer);
            const geometry = dst.geometry;
            const skinIndexAttr = geometry.getAttribute('skinIndex').array;
            const skinIndex = [];
            for (let i = 0; i < skinIndexAttr.length; i += 4) {
                skinIndex.push([skinIndexAttr[i], skinIndexAttr[i + 1], skinIndexAttr[i + 2], skinIndexAttr[i + 3]]);
            }
            const skinWeightAttr = geometry.getAttribute('skinWeight').array;
            const skinWeight = [];
            for (let i = 0; i < skinWeightAttr.length; i += 4) {
                skinWeight.push([skinWeightAttr[i], skinWeightAttr[i + 1], skinWeightAttr[i + 2], skinWeightAttr[i + 3]]);
            }
            const index = geometry.getIndex();
            if (!index) {
                throw new Error("The geometry doesn't have an index buffer");
            }
            const oldTriangles = Array.from(index.array);
            const count = this._excludeTriangles(oldTriangles, skinWeight, skinIndex, erasingBonesIndex);
            const newTriangle = [];
            for (let i = 0; i < count; i++) {
                newTriangle[i] = oldTriangles[i];
            }
            geometry.setIndex(newTriangle);
            // mtoon material includes onBeforeRender. this is unsupported at SkinnedMesh#clone
            if (src.onBeforeRender) {
                dst.onBeforeRender = src.onBeforeRender;
            }
            dst.bind(new THREE__namespace.Skeleton(src.skeleton.bones, src.skeleton.boneInverses), new THREE__namespace.Matrix4());
            return dst;
        }
        _createHeadlessModelForSkinnedMesh(parent, mesh) {
            const eraseBoneIndexes = [];
            mesh.skeleton.bones.forEach((bone, index) => {
                if (this._isEraseTarget(bone))
                    eraseBoneIndexes.push(index);
            });
            // Unlike UniVRM we don't copy mesh if no invisible bone was found
            if (!eraseBoneIndexes.length) {
                mesh.layers.enable(this._thirdPersonOnlyLayer);
                mesh.layers.enable(this._firstPersonOnlyLayer);
                return;
            }
            mesh.layers.set(this._thirdPersonOnlyLayer);
            const newMesh = this._createErasedMesh(mesh, eraseBoneIndexes);
            parent.add(newMesh);
        }
        _createHeadlessModel(primitives) {
            primitives.forEach((primitive) => {
                if (primitive.type === 'SkinnedMesh') {
                    const skinnedMesh = primitive;
                    this._createHeadlessModelForSkinnedMesh(skinnedMesh.parent, skinnedMesh);
                }
                else {
                    if (this._isEraseTarget(primitive)) {
                        primitive.layers.set(this._thirdPersonOnlyLayer);
                    }
                }
            });
        }
        /**
         * It just checks whether the node or its parent is the first person bone or not.
         * @param bone The target bone
         */
        _isEraseTarget(bone) {
            if (bone === this._firstPersonBone) {
                return true;
            }
            else if (!bone.parent) {
                return false;
            }
            else {
                return this._isEraseTarget(bone.parent);
            }
        }
    }
    /**
     * A default camera layer for `FirstPersonOnly` layer.
     *
     * @see [[getFirstPersonOnlyLayer]]
     */
    VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER = 9;
    /**
     * A default camera layer for `ThirdPersonOnly` layer.
     *
     * @see [[getThirdPersonOnlyLayer]]
     */
    VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER = 10;

    /**
     * An importer that imports a [[VRMFirstPerson]] from a VRM extension of a GLTF.
     */
    class VRMFirstPersonImporter {
        /**
         * Import a [[VRMFirstPerson]] from a VRM.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         * @param humanoid A [[VRMHumanoid]] instance that represents the VRM
         */
        import(gltf, humanoid) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt) {
                    return null;
                }
                const schemaFirstPerson = vrmExt.firstPerson;
                if (!schemaFirstPerson) {
                    return null;
                }
                const firstPersonBoneIndex = schemaFirstPerson.firstPersonBone;
                let firstPersonBone;
                if (firstPersonBoneIndex === undefined || firstPersonBoneIndex === -1) {
                    firstPersonBone = humanoid.getBoneNode(exports.VRMSchema.HumanoidBoneName.Head);
                }
                else {
                    firstPersonBone = yield gltf.parser.getDependency('node', firstPersonBoneIndex);
                }
                if (!firstPersonBone) {
                    console.warn('VRMFirstPersonImporter: Could not find firstPersonBone of the VRM');
                    return null;
                }
                const firstPersonBoneOffset = schemaFirstPerson.firstPersonBoneOffset
                    ? new THREE__namespace.Vector3(schemaFirstPerson.firstPersonBoneOffset.x, schemaFirstPerson.firstPersonBoneOffset.y, -schemaFirstPerson.firstPersonBoneOffset.z)
                    : new THREE__namespace.Vector3(0.0, 0.06, 0.0); // fallback, taken from UniVRM implementation
                const meshAnnotations = [];
                const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
                Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
                    const schemaNode = gltf.parser.json.nodes[nodeIndex];
                    const flag = schemaFirstPerson.meshAnnotations
                        ? schemaFirstPerson.meshAnnotations.find((a) => a.mesh === schemaNode.mesh)
                        : undefined;
                    meshAnnotations.push(new VRMRendererFirstPersonFlags(flag === null || flag === void 0 ? void 0 : flag.firstPersonFlag, primitives));
                });
                return new VRMFirstPerson(firstPersonBone, firstPersonBoneOffset, meshAnnotations);
            });
        }
    }

    /**
     * A class represents a single `humanBone` of a VRM.
     */
    class VRMHumanBone {
        /**
         * Create a new VRMHumanBone.
         *
         * @param node A [[GLTFNode]] that represents the new bone
         * @param humanLimit A [[VRMHumanLimit]] object that represents properties of the new bone
         */
        constructor(node, humanLimit) {
            this.node = node;
            this.humanLimit = humanLimit;
        }
    }

    /**
     * A compat function for `Quaternion.invert()` / `Quaternion.inverse()`.
     * `Quaternion.invert()` is introduced in r123 and `Quaternion.inverse()` emits a warning.
     * We are going to use this compat for a while.
     * @param target A target quaternion
     */
    function quatInvertCompat(target) {
        if (target.invert) {
            target.invert();
        }
        else {
            target.inverse();
        }
        return target;
    }

    const _v3A$4 = new THREE__namespace.Vector3();
    const _quatA$1 = new THREE__namespace.Quaternion();
    /**
     * A class represents humanoid of a VRM.
     */
    class VRMHumanoid {
        /**
         * Create a new [[VRMHumanoid]].
         * @param boneArray A [[VRMHumanBoneArray]] contains all the bones of the new humanoid
         * @param humanDescription A [[VRMHumanDescription]] that represents properties of the new humanoid
         */
        constructor(boneArray, humanDescription) {
            /**
             * A [[VRMPose]] that is its default state.
             * Note that it's not compatible with `setPose` and `getPose`, since it contains non-relative values of each local transforms.
             */
            this.restPose = {};
            this.humanBones = this._createHumanBones(boneArray);
            this.humanDescription = humanDescription;
            this.restPose = this.getPose();
        }
        /**
         * Return the current pose of this humanoid as a [[VRMPose]].
         *
         * Each transform is a local transform relative from rest pose (T-pose).
         */
        getPose() {
            const pose = {};
            Object.keys(this.humanBones).forEach((vrmBoneName) => {
                const node = this.getBoneNode(vrmBoneName);
                // Ignore when there are no bone on the VRMHumanoid
                if (!node) {
                    return;
                }
                // When there are two or more bones in a same name, we are not going to overwrite existing one
                if (pose[vrmBoneName]) {
                    return;
                }
                // Take a diff from restPose
                // note that restPose also will use getPose to initialize itself
                _v3A$4.set(0, 0, 0);
                _quatA$1.identity();
                const restState = this.restPose[vrmBoneName];
                if (restState === null || restState === void 0 ? void 0 : restState.position) {
                    _v3A$4.fromArray(restState.position).negate();
                }
                if (restState === null || restState === void 0 ? void 0 : restState.rotation) {
                    quatInvertCompat(_quatA$1.fromArray(restState.rotation));
                }
                // Get the position / rotation from the node
                _v3A$4.add(node.position);
                _quatA$1.premultiply(node.quaternion);
                pose[vrmBoneName] = {
                    position: _v3A$4.toArray(),
                    rotation: _quatA$1.toArray(),
                };
            }, {});
            return pose;
        }
        /**
         * Let the humanoid do a specified pose.
         *
         * Each transform have to be a local transform relative from rest pose (T-pose).
         * You can pass what you got from {@link getPose}.
         *
         * @param poseObject A [[VRMPose]] that represents a single pose
         */
        setPose(poseObject) {
            Object.keys(poseObject).forEach((boneName) => {
                const state = poseObject[boneName];
                const node = this.getBoneNode(boneName);
                // Ignore when there are no bone that is defined in the pose on the VRMHumanoid
                if (!node) {
                    return;
                }
                const restState = this.restPose[boneName];
                if (!restState) {
                    return;
                }
                if (state.position) {
                    node.position.fromArray(state.position);
                    if (restState.position) {
                        node.position.add(_v3A$4.fromArray(restState.position));
                    }
                }
                if (state.rotation) {
                    node.quaternion.fromArray(state.rotation);
                    if (restState.rotation) {
                        node.quaternion.multiply(_quatA$1.fromArray(restState.rotation));
                    }
                }
            });
        }
        /**
         * Reset the humanoid to its rest pose.
         */
        resetPose() {
            Object.entries(this.restPose).forEach(([boneName, rest]) => {
                const node = this.getBoneNode(boneName);
                if (!node) {
                    return;
                }
                if (rest === null || rest === void 0 ? void 0 : rest.position) {
                    node.position.fromArray(rest.position);
                }
                if (rest === null || rest === void 0 ? void 0 : rest.rotation) {
                    node.quaternion.fromArray(rest.rotation);
                }
            });
        }
        /**
         * Return a bone bound to a specified [[HumanBone]], as a [[VRMHumanBone]].
         *
         * See also: [[VRMHumanoid.getBones]]
         *
         * @param name Name of the bone you want
         */
        getBone(name) {
            var _a;
            return (_a = this.humanBones[name][0]) !== null && _a !== void 0 ? _a : undefined;
        }
        /**
         * Return bones bound to a specified [[HumanBone]], as an array of [[VRMHumanBone]].
         * If there are no bones bound to the specified HumanBone, it will return an empty array.
         *
         * See also: [[VRMHumanoid.getBone]]
         *
         * @param name Name of the bone you want
         */
        getBones(name) {
            var _a;
            return (_a = this.humanBones[name]) !== null && _a !== void 0 ? _a : [];
        }
        /**
         * Return a bone bound to a specified [[HumanBone]], as a THREE.Object3D.
         *
         * See also: [[VRMHumanoid.getBoneNodes]]
         *
         * @param name Name of the bone you want
         */
        getBoneNode(name) {
            var _a, _b;
            return (_b = (_a = this.humanBones[name][0]) === null || _a === void 0 ? void 0 : _a.node) !== null && _b !== void 0 ? _b : null;
        }
        /**
         * Return bones bound to a specified [[HumanBone]], as an array of THREE.Object3D.
         * If there are no bones bound to the specified HumanBone, it will return an empty array.
         *
         * See also: [[VRMHumanoid.getBoneNode]]
         *
         * @param name Name of the bone you want
         */
        getBoneNodes(name) {
            var _a, _b;
            return (_b = (_a = this.humanBones[name]) === null || _a === void 0 ? void 0 : _a.map((bone) => bone.node)) !== null && _b !== void 0 ? _b : [];
        }
        /**
         * Prepare a [[VRMHumanBones]] from a [[VRMHumanBoneArray]].
         */
        _createHumanBones(boneArray) {
            const bones = Object.values(exports.VRMSchema.HumanoidBoneName).reduce((accum, name) => {
                accum[name] = [];
                return accum;
            }, {});
            boneArray.forEach((bone) => {
                bones[bone.name].push(bone.bone);
            });
            return bones;
        }
    }

    /**
     * An importer that imports a [[VRMHumanoid]] from a VRM extension of a GLTF.
     */
    class VRMHumanoidImporter {
        /**
         * Import a [[VRMHumanoid]] from a VRM.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         */
        import(gltf) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt) {
                    return null;
                }
                const schemaHumanoid = vrmExt.humanoid;
                if (!schemaHumanoid) {
                    return null;
                }
                const humanBoneArray = [];
                if (schemaHumanoid.humanBones) {
                    yield Promise.all(schemaHumanoid.humanBones.map((bone) => __awaiter(this, void 0, void 0, function* () {
                        if (!bone.bone || bone.node == null) {
                            return;
                        }
                        const node = yield gltf.parser.getDependency('node', bone.node);
                        humanBoneArray.push({
                            name: bone.bone,
                            bone: new VRMHumanBone(node, {
                                axisLength: bone.axisLength,
                                center: bone.center && new THREE__namespace.Vector3(bone.center.x, bone.center.y, bone.center.z),
                                max: bone.max && new THREE__namespace.Vector3(bone.max.x, bone.max.y, bone.max.z),
                                min: bone.min && new THREE__namespace.Vector3(bone.min.x, bone.min.y, bone.min.z),
                                useDefaultValues: bone.useDefaultValues,
                            }),
                        });
                    })));
                }
                const humanDescription = {
                    armStretch: schemaHumanoid.armStretch,
                    legStretch: schemaHumanoid.legStretch,
                    upperArmTwist: schemaHumanoid.upperArmTwist,
                    lowerArmTwist: schemaHumanoid.lowerArmTwist,
                    upperLegTwist: schemaHumanoid.upperLegTwist,
                    lowerLegTwist: schemaHumanoid.lowerLegTwist,
                    feetSpacing: schemaHumanoid.feetSpacing,
                    hasTranslationDoF: schemaHumanoid.hasTranslationDoF,
                };
                return new VRMHumanoid(humanBoneArray, humanDescription);
            });
        }
    }

    /**
     * Evaluate a hermite spline.
     *
     * @param y0 y on start
     * @param y1 y on end
     * @param t0 delta y on start
     * @param t1 delta y on end
     * @param x input value
     */
    const hermiteSpline = (y0, y1, t0, t1, x) => {
        const xc = x * x * x;
        const xs = x * x;
        const dy = y1 - y0;
        const h01 = -2.0 * xc + 3.0 * xs;
        const h10 = xc - 2.0 * xs + x;
        const h11 = xc - xs;
        return y0 + dy * h01 + t0 * h10 + t1 * h11;
    };
    /**
     * Evaluate an AnimationCurve array. See AnimationCurve class of Unity for its details.
     *
     * See: https://docs.unity3d.com/ja/current/ScriptReference/AnimationCurve.html
     *
     * @param arr An array represents a curve
     * @param x An input value
     */
    const evaluateCurve = (arr, x) => {
        // -- sanity check -----------------------------------------------------------
        if (arr.length < 8) {
            throw new Error('evaluateCurve: Invalid curve detected! (Array length must be 8 at least)');
        }
        if (arr.length % 4 !== 0) {
            throw new Error('evaluateCurve: Invalid curve detected! (Array length must be multiples of 4');
        }
        // -- check range ------------------------------------------------------------
        let outNode;
        for (outNode = 0;; outNode++) {
            if (arr.length <= 4 * outNode) {
                return arr[4 * outNode - 3]; // too further!! assume as "Clamp"
            }
            else if (x <= arr[4 * outNode]) {
                break;
            }
        }
        const inNode = outNode - 1;
        if (inNode < 0) {
            return arr[4 * inNode + 5]; // too behind!! assume as "Clamp"
        }
        // -- calculate local x ------------------------------------------------------
        const x0 = arr[4 * inNode];
        const x1 = arr[4 * outNode];
        const xHermite = (x - x0) / (x1 - x0);
        // -- finally do the hermite spline ------------------------------------------
        const y0 = arr[4 * inNode + 1];
        const y1 = arr[4 * outNode + 1];
        const t0 = arr[4 * inNode + 3];
        const t1 = arr[4 * outNode + 2];
        return hermiteSpline(y0, y1, t0, t1, xHermite);
    };
    /**
     * This is an equivalent of CurveMapper class defined in UniVRM.
     * Will be used for [[VRMLookAtApplyer]]s, to define behavior of LookAt.
     *
     * See: https://github.com/vrm-c/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/LookAt/CurveMapper.cs
     */
    class VRMCurveMapper {
        /**
         * Create a new [[VRMCurveMapper]].
         *
         * @param xRange The maximum input range
         * @param yRange The maximum output value
         * @param curve An array represents the curve
         */
        constructor(xRange, yRange, curve) {
            /**
             * An array represents the curve. See AnimationCurve class of Unity for its details.
             *
             * See: https://docs.unity3d.com/ja/current/ScriptReference/AnimationCurve.html
             */
            this.curve = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0];
            /**
             * The maximum input range of the [[VRMCurveMapper]].
             */
            this.curveXRangeDegree = 90.0;
            /**
             * The maximum output value of the [[VRMCurveMapper]].
             */
            this.curveYRangeDegree = 10.0;
            if (xRange !== undefined) {
                this.curveXRangeDegree = xRange;
            }
            if (yRange !== undefined) {
                this.curveYRangeDegree = yRange;
            }
            if (curve !== undefined) {
                this.curve = curve;
            }
        }
        /**
         * Evaluate an input value and output a mapped value.
         *
         * @param src The input value
         */
        map(src) {
            const clampedSrc = Math.min(Math.max(src, 0.0), this.curveXRangeDegree);
            const x = clampedSrc / this.curveXRangeDegree;
            return this.curveYRangeDegree * evaluateCurve(this.curve, x);
        }
    }

    /**
     * This class is used by [[VRMLookAtHead]], applies look at direction.
     * There are currently two variant of applier: [[VRMLookAtBoneApplyer]] and [[VRMLookAtBlendShapeApplyer]].
     */
    class VRMLookAtApplyer {
    }

    /**
     * This class is used by [[VRMLookAtHead]], applies look at direction to eye blend shapes of a VRM.
     */
    class VRMLookAtBlendShapeApplyer extends VRMLookAtApplyer {
        /**
         * Create a new VRMLookAtBlendShapeApplyer.
         *
         * @param blendShapeProxy A [[VRMBlendShapeProxy]] used by this applier
         * @param curveHorizontal A [[VRMCurveMapper]] used for transverse direction
         * @param curveVerticalDown A [[VRMCurveMapper]] used for down direction
         * @param curveVerticalUp A [[VRMCurveMapper]] used for up direction
         */
        constructor(blendShapeProxy, curveHorizontal, curveVerticalDown, curveVerticalUp) {
            super();
            this.type = exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape;
            this._curveHorizontal = curveHorizontal;
            this._curveVerticalDown = curveVerticalDown;
            this._curveVerticalUp = curveVerticalUp;
            this._blendShapeProxy = blendShapeProxy;
        }
        name() {
            return exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape;
        }
        lookAt(euler) {
            const srcX = euler.x;
            const srcY = euler.y;
            if (srcX < 0.0) {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookup, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookdown, this._curveVerticalDown.map(-srcX));
            }
            else {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookdown, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookup, this._curveVerticalUp.map(srcX));
            }
            if (srcY < 0.0) {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookleft, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookright, this._curveHorizontal.map(-srcY));
            }
            else {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookright, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookleft, this._curveHorizontal.map(srcY));
            }
        }
    }

    const VECTOR3_FRONT = Object.freeze(new THREE__namespace.Vector3(0.0, 0.0, -1.0));
    const _v3A$3 = new THREE__namespace.Vector3();
    const _v3B$1 = new THREE__namespace.Vector3();
    const _v3C$1 = new THREE__namespace.Vector3();
    const _quat = new THREE__namespace.Quaternion();
    /**
     * A class represents look at of a VRM.
     */
    class VRMLookAtHead {
        /**
         * Create a new VRMLookAtHead.
         *
         * @param firstPerson A [[VRMFirstPerson]] that will be associated with this new VRMLookAtHead
         * @param applyer A [[VRMLookAtApplyer]] that will be associated with this new VRMLookAtHead
         */
        constructor(firstPerson, applyer) {
            /**
             * If this is true, its look at direction will be updated automatically by calling [[VRMLookAtHead.update]] (which is called from [[VRM.update]]).
             *
             * See also: [[VRMLookAtHead.target]]
             */
            this.autoUpdate = true;
            this._euler = new THREE__namespace.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
            this.firstPerson = firstPerson;
            this.applyer = applyer;
        }
        /**
         * Get its look at direction in world coordinate.
         *
         * @param target A target `THREE.Vector3`
         */
        getLookAtWorldDirection(target) {
            const rot = getWorldQuaternionLite(this.firstPerson.firstPersonBone, _quat);
            return target.copy(VECTOR3_FRONT).applyEuler(this._euler).applyQuaternion(rot);
        }
        /**
         * Set its look at position.
         * Note that its result will be instantly overwritten if [[VRMLookAtHead.autoUpdate]] is enabled.
         *
         * @param position A target position
         */
        lookAt(position) {
            this._calcEuler(this._euler, position);
            if (this.applyer) {
                this.applyer.lookAt(this._euler);
            }
        }
        /**
         * Update the VRMLookAtHead.
         * If [[VRMLookAtHead.autoUpdate]] is disabled, it will do nothing.
         *
         * @param delta deltaTime
         */
        update(delta) {
            if (this.target && this.autoUpdate) {
                this.lookAt(this.target.getWorldPosition(_v3A$3));
                if (this.applyer) {
                    this.applyer.lookAt(this._euler);
                }
            }
        }
        _calcEuler(target, position) {
            const headPosition = this.firstPerson.getFirstPersonWorldPosition(_v3B$1);
            // Look at direction in world coordinate
            const lookAtDir = _v3C$1.copy(position).sub(headPosition).normalize();
            // Transform the direction into local coordinate from the first person bone
            lookAtDir.applyQuaternion(quatInvertCompat(getWorldQuaternionLite(this.firstPerson.firstPersonBone, _quat)));
            // convert the direction into euler
            target.x = Math.atan2(lookAtDir.y, Math.sqrt(lookAtDir.x * lookAtDir.x + lookAtDir.z * lookAtDir.z));
            target.y = Math.atan2(-lookAtDir.x, -lookAtDir.z);
            return target;
        }
    }
    VRMLookAtHead.EULER_ORDER = 'YXZ'; // yaw-pitch-roll

    const _euler = new THREE__namespace.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
    /**
     * This class is used by [[VRMLookAtHead]], applies look at direction to eye bones of a VRM.
     */
    class VRMLookAtBoneApplyer extends VRMLookAtApplyer {
        /**
         * Create a new VRMLookAtBoneApplyer.
         *
         * @param humanoid A [[VRMHumanoid]] used by this applier
         * @param curveHorizontalInner A [[VRMCurveMapper]] used for inner transverse direction
         * @param curveHorizontalOuter A [[VRMCurveMapper]] used for outer transverse direction
         * @param curveVerticalDown A [[VRMCurveMapper]] used for down direction
         * @param curveVerticalUp A [[VRMCurveMapper]] used for up direction
         */
        constructor(humanoid, curveHorizontalInner, curveHorizontalOuter, curveVerticalDown, curveVerticalUp) {
            super();
            this.type = exports.VRMSchema.FirstPersonLookAtTypeName.Bone;
            this._curveHorizontalInner = curveHorizontalInner;
            this._curveHorizontalOuter = curveHorizontalOuter;
            this._curveVerticalDown = curveVerticalDown;
            this._curveVerticalUp = curveVerticalUp;
            this._leftEye = humanoid.getBoneNode(exports.VRMSchema.HumanoidBoneName.LeftEye);
            this._rightEye = humanoid.getBoneNode(exports.VRMSchema.HumanoidBoneName.RightEye);
        }
        lookAt(euler) {
            const srcX = euler.x;
            const srcY = euler.y;
            // left
            if (this._leftEye) {
                if (srcX < 0.0) {
                    _euler.x = -this._curveVerticalDown.map(-srcX);
                }
                else {
                    _euler.x = this._curveVerticalUp.map(srcX);
                }
                if (srcY < 0.0) {
                    _euler.y = -this._curveHorizontalInner.map(-srcY);
                }
                else {
                    _euler.y = this._curveHorizontalOuter.map(srcY);
                }
                this._leftEye.quaternion.setFromEuler(_euler);
            }
            // right
            if (this._rightEye) {
                if (srcX < 0.0) {
                    _euler.x = -this._curveVerticalDown.map(-srcX);
                }
                else {
                    _euler.x = this._curveVerticalUp.map(srcX);
                }
                if (srcY < 0.0) {
                    _euler.y = -this._curveHorizontalOuter.map(-srcY);
                }
                else {
                    _euler.y = this._curveHorizontalInner.map(srcY);
                }
                this._rightEye.quaternion.setFromEuler(_euler);
            }
        }
    }

    // THREE.Math has been renamed to THREE.MathUtils since r113.
    // We are going to define the DEG2RAD by ourselves for a while
    // https://github.com/mrdoob/three.js/pull/18270
    const DEG2RAD = Math.PI / 180; // THREE.MathUtils.DEG2RAD;
    /**
     * An importer that imports a [[VRMLookAtHead]] from a VRM extension of a GLTF.
     */
    class VRMLookAtImporter {
        /**
         * Import a [[VRMLookAtHead]] from a VRM.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         * @param blendShapeProxy A [[VRMBlendShapeProxy]] instance that represents the VRM
         * @param humanoid A [[VRMHumanoid]] instance that represents the VRM
         */
        import(gltf, firstPerson, blendShapeProxy, humanoid) {
            var _a;
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaFirstPerson = vrmExt.firstPerson;
            if (!schemaFirstPerson) {
                return null;
            }
            const applyer = this._importApplyer(schemaFirstPerson, blendShapeProxy, humanoid);
            return new VRMLookAtHead(firstPerson, applyer || undefined);
        }
        _importApplyer(schemaFirstPerson, blendShapeProxy, humanoid) {
            const lookAtHorizontalInner = schemaFirstPerson.lookAtHorizontalInner;
            const lookAtHorizontalOuter = schemaFirstPerson.lookAtHorizontalOuter;
            const lookAtVerticalDown = schemaFirstPerson.lookAtVerticalDown;
            const lookAtVerticalUp = schemaFirstPerson.lookAtVerticalUp;
            switch (schemaFirstPerson.lookAtTypeName) {
                case exports.VRMSchema.FirstPersonLookAtTypeName.Bone: {
                    if (lookAtHorizontalInner === undefined ||
                        lookAtHorizontalOuter === undefined ||
                        lookAtVerticalDown === undefined ||
                        lookAtVerticalUp === undefined) {
                        return null;
                    }
                    else {
                        return new VRMLookAtBoneApplyer(humanoid, this._importCurveMapperBone(lookAtHorizontalInner), this._importCurveMapperBone(lookAtHorizontalOuter), this._importCurveMapperBone(lookAtVerticalDown), this._importCurveMapperBone(lookAtVerticalUp));
                    }
                }
                case exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape: {
                    if (lookAtHorizontalOuter === undefined || lookAtVerticalDown === undefined || lookAtVerticalUp === undefined) {
                        return null;
                    }
                    else {
                        return new VRMLookAtBlendShapeApplyer(blendShapeProxy, this._importCurveMapperBlendShape(lookAtHorizontalOuter), this._importCurveMapperBlendShape(lookAtVerticalDown), this._importCurveMapperBlendShape(lookAtVerticalUp));
                    }
                }
                default: {
                    return null;
                }
            }
        }
        _importCurveMapperBone(map) {
            return new VRMCurveMapper(typeof map.xRange === 'number' ? DEG2RAD * map.xRange : undefined, typeof map.yRange === 'number' ? DEG2RAD * map.yRange : undefined, map.curve);
        }
        _importCurveMapperBlendShape(map) {
            return new VRMCurveMapper(typeof map.xRange === 'number' ? DEG2RAD * map.xRange : undefined, map.yRange, map.curve);
        }
    }

    const getEncodingComponents = (encoding) => {
        switch (encoding) {
            case THREE__namespace.LinearEncoding:
                return ['Linear', '( value )'];
            case THREE__namespace.sRGBEncoding:
                return ['sRGB', '( value )'];
            case THREE__namespace.RGBEEncoding:
                return ['RGBE', '( value )'];
            case THREE__namespace.RGBM7Encoding:
                return ['RGBM', '( value, 7.0 )'];
            case THREE__namespace.RGBM16Encoding:
                return ['RGBM', '( value, 16.0 )'];
            case THREE__namespace.RGBDEncoding:
                return ['RGBD', '( value, 256.0 )'];
            case THREE__namespace.GammaEncoding:
                return ['Gamma', '( value, float( GAMMA_FACTOR ) )'];
            default:
                throw new Error('unsupported encoding: ' + encoding);
        }
    };
    const getTexelDecodingFunction = (functionName, encoding) => {
        const components = getEncodingComponents(encoding);
        return 'vec4 ' + functionName + '( vec4 value ) { return ' + components[0] + 'ToLinear' + components[1] + '; }';
    };

    var vertexShader$1 = "// #define PHONG\r\n\r\nvarying vec3 vViewPosition;\r\n\r\n#ifndef FLAT_SHADED\r\n  varying vec3 vNormal;\r\n#endif\r\n\r\n#include <common>\r\n\r\n// #include <uv_pars_vertex>\r\n#ifdef MTOON_USE_UV\r\n  #ifdef MTOON_UVS_VERTEX_ONLY\r\n    vec2 vUv;\r\n  #else\r\n    varying vec2 vUv;\r\n  #endif\r\n\r\n  uniform vec4 mainTex_ST;\r\n#endif\r\n\r\n#include <uv2_pars_vertex>\r\n// #include <displacementmap_pars_vertex>\r\n// #include <envmap_pars_vertex>\r\n#include <color_pars_vertex>\r\n#include <fog_pars_vertex>\r\n#include <morphtarget_pars_vertex>\r\n#include <skinning_pars_vertex>\r\n#include <shadowmap_pars_vertex>\r\n#include <logdepthbuf_pars_vertex>\r\n#include <clipping_planes_pars_vertex>\r\n\r\n#ifdef USE_OUTLINEWIDTHTEXTURE\r\n  uniform sampler2D outlineWidthTexture;\r\n#endif\r\n\r\nuniform float outlineWidth;\r\nuniform float outlineScaledMaxDistance;\r\n\r\nvoid main() {\r\n\r\n  // #include <uv_vertex>\r\n  #ifdef MTOON_USE_UV\r\n    vUv = uv;\r\n    vUv.y = 1.0 - vUv.y; // uv.y is opposite from UniVRM's\r\n    vUv = mainTex_ST.st + mainTex_ST.pq * vUv;\r\n    vUv.y = 1.0 - vUv.y; // reverting the previous flip\r\n  #endif\r\n\r\n  #include <uv2_vertex>\r\n  #include <color_vertex>\r\n\r\n  #include <beginnormal_vertex>\r\n  #include <morphnormal_vertex>\r\n  #include <skinbase_vertex>\r\n  #include <skinnormal_vertex>\r\n\r\n  // we need this to compute the outline properly\r\n  objectNormal = normalize( objectNormal );\r\n\r\n  #include <defaultnormal_vertex>\r\n\r\n  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED\r\n    vNormal = normalize( transformedNormal );\r\n  #endif\r\n\r\n  #include <begin_vertex>\r\n\r\n  #include <morphtarget_vertex>\r\n  #include <skinning_vertex>\r\n  // #include <displacementmap_vertex>\r\n  #include <project_vertex>\r\n  #include <logdepthbuf_vertex>\r\n  #include <clipping_planes_vertex>\r\n\r\n  vViewPosition = - mvPosition.xyz;\r\n\r\n  float outlineTex = 1.0;\r\n\r\n  #ifdef OUTLINE\r\n    #ifdef USE_OUTLINEWIDTHTEXTURE\r\n      outlineTex = texture2D( outlineWidthTexture, vUv ).r;\r\n    #endif\r\n\r\n    #ifdef OUTLINE_WIDTH_WORLD\r\n      float worldNormalLength = length( transformedNormal );\r\n      vec3 outlineOffset = 0.01 * outlineWidth * outlineTex * worldNormalLength * objectNormal;\r\n      gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );\r\n    #endif\r\n\r\n    #ifdef OUTLINE_WIDTH_SCREEN\r\n      vec3 clipNormal = ( projectionMatrix * modelViewMatrix * vec4( objectNormal, 0.0 ) ).xyz;\r\n      vec2 projectedNormal = normalize( clipNormal.xy );\r\n      projectedNormal *= min( gl_Position.w, outlineScaledMaxDistance );\r\n      projectedNormal.x *= projectionMatrix[ 0 ].x / projectionMatrix[ 1 ].y;\r\n      gl_Position.xy += 0.01 * outlineWidth * outlineTex * projectedNormal.xy;\r\n    #endif\r\n\r\n    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic\r\n  #endif\r\n\r\n  #include <worldpos_vertex>\r\n  // #include <envmap_vertex>\r\n  #include <shadowmap_vertex>\r\n  #include <fog_vertex>\r\n\r\n}";

    var fragmentShader$1 = "// #define PHONG\r\n\r\n#ifdef BLENDMODE_CUTOUT\r\n  uniform float cutoff;\r\n#endif\r\n\r\nuniform vec3 color;\r\nuniform float colorAlpha;\r\nuniform vec3 shadeColor;\r\n#ifdef USE_SHADETEXTURE\r\n  uniform sampler2D shadeTexture;\r\n#endif\r\n\r\nuniform float receiveShadowRate;\r\n#ifdef USE_RECEIVESHADOWTEXTURE\r\n  uniform sampler2D receiveShadowTexture;\r\n#endif\r\n\r\nuniform float shadingGradeRate;\r\n#ifdef USE_SHADINGGRADETEXTURE\r\n  uniform sampler2D shadingGradeTexture;\r\n#endif\r\n\r\nuniform float shadeShift;\r\nuniform float shadeToony;\r\nuniform float lightColorAttenuation;\r\nuniform float indirectLightIntensity;\r\n\r\n#ifdef USE_RIMTEXTURE\r\n  uniform sampler2D rimTexture;\r\n#endif\r\nuniform vec3 rimColor;\r\nuniform float rimLightingMix;\r\nuniform float rimFresnelPower;\r\nuniform float rimLift;\r\n\r\n#ifdef USE_SPHEREADD\r\n  uniform sampler2D sphereAdd;\r\n#endif\r\n\r\nuniform vec3 emissionColor;\r\n\r\nuniform vec3 outlineColor;\r\nuniform float outlineLightingMix;\r\n\r\n#ifdef USE_UVANIMMASKTEXTURE\r\n  uniform sampler2D uvAnimMaskTexture;\r\n#endif\r\n\r\nuniform float uvAnimOffsetX;\r\nuniform float uvAnimOffsetY;\r\nuniform float uvAnimTheta;\r\n\r\n#include <common>\r\n#include <packing>\r\n#include <dithering_pars_fragment>\r\n#include <color_pars_fragment>\r\n\r\n// #include <uv_pars_fragment>\r\n#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\r\n  varying vec2 vUv;\r\n#endif\r\n\r\n#include <uv2_pars_fragment>\r\n#include <map_pars_fragment>\r\n// #include <alphamap_pars_fragment>\r\n#include <aomap_pars_fragment>\r\n// #include <lightmap_pars_fragment>\r\n#include <emissivemap_pars_fragment>\r\n// #include <envmap_common_pars_fragment>\r\n// #include <envmap_pars_fragment>\r\n// #include <cube_uv_reflection_fragment>\r\n#include <fog_pars_fragment>\r\n#include <bsdfs>\r\n#include <lights_pars_begin>\r\n\r\n// #include <lights_phong_pars_fragment>\r\nvarying vec3 vViewPosition;\r\n\r\n#ifndef FLAT_SHADED\r\n  varying vec3 vNormal;\r\n#endif\r\n\r\nstruct MToonMaterial {\r\n  vec3 diffuseColor;\r\n  vec3 shadeColor;\r\n  float shadingGrade;\r\n  float receiveShadow;\r\n};\r\n\r\n#define Material_LightProbeLOD( material ) (0)\r\n\r\n#include <shadowmap_pars_fragment>\r\n// #include <bumpmap_pars_fragment>\r\n\r\n// #include <normalmap_pars_fragment>\r\n#ifdef USE_NORMALMAP\r\n\r\n  uniform sampler2D normalMap;\r\n  uniform vec2 normalScale;\r\n\r\n#endif\r\n\r\n#ifdef OBJECTSPACE_NORMALMAP\r\n\r\n  uniform mat3 normalMatrix;\r\n\r\n#endif\r\n\r\n#if ! defined ( USE_TANGENT ) && defined ( TANGENTSPACE_NORMALMAP )\r\n\r\n  // Per-Pixel Tangent Space Normal Mapping\r\n  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html\r\n\r\n  // three-vrm specific change: it requires `uv` as an input in order to support uv scrolls\r\n\r\n  // Temporary compat against shader change @ Three.js r126\r\n  // See: #21205, #21307, #21299\r\n  #ifdef THREE_VRM_THREE_REVISION_126\r\n\r\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\r\n\r\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\r\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\r\n      vec2 st0 = dFdx( uv.st );\r\n      vec2 st1 = dFdy( uv.st );\r\n\r\n      vec3 N = normalize( surf_norm );\r\n\r\n      vec3 q1perp = cross( q1, N );\r\n      vec3 q0perp = cross( N, q0 );\r\n\r\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\r\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\r\n\r\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\r\n      // TODO: Is this still required? Or shall I make a PR about it?\r\n      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {\r\n        return surf_norm;\r\n      }\r\n\r\n      float det = max( dot( T, T ), dot( B, B ) );\r\n      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\r\n\r\n      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\r\n\r\n    }\r\n\r\n  #else\r\n\r\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN ) {\r\n\r\n      // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988\r\n\r\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\r\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\r\n      vec2 st0 = dFdx( uv.st );\r\n      vec2 st1 = dFdy( uv.st );\r\n\r\n      float scale = sign( st1.t * st0.s - st0.t * st1.s ); // we do not care about the magnitude\r\n\r\n      vec3 S = ( q0 * st1.t - q1 * st0.t ) * scale;\r\n      vec3 T = ( - q0 * st1.s + q1 * st0.s ) * scale;\r\n\r\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\r\n      // TODO: Is this still required? Or shall I make a PR about it?\r\n\r\n      if ( length( S ) == 0.0 || length( T ) == 0.0 ) {\r\n        return surf_norm;\r\n      }\r\n\r\n      S = normalize( S );\r\n      T = normalize( T );\r\n      vec3 N = normalize( surf_norm );\r\n\r\n      #ifdef DOUBLE_SIDED\r\n\r\n        // Workaround for Adreno GPUs gl_FrontFacing bug. See #15850 and #10331\r\n\r\n        bool frontFacing = dot( cross( S, T ), N ) > 0.0;\r\n\r\n        mapN.xy *= ( float( frontFacing ) * 2.0 - 1.0 );\r\n\r\n      #else\r\n\r\n        mapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );\r\n\r\n      #endif\r\n\r\n      mat3 tsn = mat3( S, T, N );\r\n      return normalize( tsn * mapN );\r\n\r\n    }\r\n\r\n  #endif\r\n\r\n#endif\r\n\r\n// #include <specularmap_pars_fragment>\r\n#include <logdepthbuf_pars_fragment>\r\n#include <clipping_planes_pars_fragment>\r\n\r\n// == lighting stuff ===========================================================\r\nfloat getLightIntensity(\r\n  const in IncidentLight directLight,\r\n  const in GeometricContext geometry,\r\n  const in float shadow,\r\n  const in float shadingGrade\r\n) {\r\n  float lightIntensity = dot( geometry.normal, directLight.direction );\r\n  lightIntensity = 0.5 + 0.5 * lightIntensity;\r\n  lightIntensity = lightIntensity * shadow;\r\n  lightIntensity = lightIntensity * shadingGrade;\r\n  lightIntensity = lightIntensity * 2.0 - 1.0;\r\n  return shadeToony == 1.0\r\n    ? step( shadeShift, lightIntensity )\r\n    : smoothstep( shadeShift, shadeShift + ( 1.0 - shadeToony ), lightIntensity );\r\n}\r\n\r\nvec3 getLighting( const in vec3 lightColor ) {\r\n  vec3 lighting = lightColor;\r\n  lighting = mix(\r\n    lighting,\r\n    vec3( max( 0.001, max( lighting.x, max( lighting.y, lighting.z ) ) ) ),\r\n    lightColorAttenuation\r\n  );\r\n\r\n  #ifndef PHYSICALLY_CORRECT_LIGHTS\r\n    lighting *= PI;\r\n  #endif\r\n\r\n  return lighting;\r\n}\r\n\r\nvec3 getDiffuse(\r\n  const in MToonMaterial material,\r\n  const in float lightIntensity,\r\n  const in vec3 lighting\r\n) {\r\n  #ifdef DEBUG_LITSHADERATE\r\n    return vec3( BRDF_Diffuse_Lambert( lightIntensity * lighting ) );\r\n  #endif\r\n\r\n  return lighting * BRDF_Diffuse_Lambert( mix( material.shadeColor, material.diffuseColor, lightIntensity ) );\r\n}\r\n\r\n// == post correction ==========================================================\r\nvoid postCorrection() {\r\n  #include <tonemapping_fragment>\r\n  #include <encodings_fragment>\r\n  #include <fog_fragment>\r\n  #include <premultiplied_alpha_fragment>\r\n  #include <dithering_fragment>\r\n}\r\n\r\n// == main procedure ===========================================================\r\nvoid main() {\r\n  #include <clipping_planes_fragment>\r\n\r\n  vec2 uv = vec2(0.5, 0.5);\r\n\r\n  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\r\n    uv = vUv;\r\n\r\n    float uvAnimMask = 1.0;\r\n    #ifdef USE_UVANIMMASKTEXTURE\r\n      uvAnimMask = texture2D( uvAnimMaskTexture, uv ).x;\r\n    #endif\r\n\r\n    uv = uv + vec2( uvAnimOffsetX, uvAnimOffsetY ) * uvAnimMask;\r\n    float uvRotCos = cos( uvAnimTheta * uvAnimMask );\r\n    float uvRotSin = sin( uvAnimTheta * uvAnimMask );\r\n    uv = mat2( uvRotCos, uvRotSin, -uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;\r\n  #endif\r\n\r\n  #ifdef DEBUG_UV\r\n    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\r\n    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\r\n      gl_FragColor = vec4( uv, 0.0, 1.0 );\r\n    #endif\r\n    return;\r\n  #endif\r\n\r\n  vec4 diffuseColor = vec4( color, colorAlpha );\r\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\r\n  vec3 totalEmissiveRadiance = emissionColor;\r\n\r\n  #include <logdepthbuf_fragment>\r\n\r\n  // #include <map_fragment>\r\n  #ifdef USE_MAP\r\n    diffuseColor *= mapTexelToLinear( texture2D( map, uv ) );\r\n  #endif\r\n\r\n  #include <color_fragment>\r\n  // #include <alphamap_fragment>\r\n\r\n  // -- MToon: alpha -----------------------------------------------------------\r\n  // #include <alphatest_fragment>\r\n  #ifdef BLENDMODE_CUTOUT\r\n    if ( diffuseColor.a <= cutoff ) { discard; }\r\n    diffuseColor.a = 1.0;\r\n  #endif\r\n\r\n  #ifdef BLENDMODE_OPAQUE\r\n    diffuseColor.a = 1.0;\r\n  #endif\r\n\r\n  #if defined( OUTLINE ) && defined( OUTLINE_COLOR_FIXED ) // omitting DebugMode\r\n    gl_FragColor = vec4( outlineColor, diffuseColor.a );\r\n    postCorrection();\r\n    return;\r\n  #endif\r\n\r\n  // #include <specularmap_fragment>\r\n  #include <normal_fragment_begin>\r\n\r\n  #ifdef OUTLINE\r\n    normal *= -1.0;\r\n  #endif\r\n\r\n  // #include <normal_fragment_maps>\r\n\r\n  #ifdef OBJECTSPACE_NORMALMAP\r\n\r\n    normal = texture2D( normalMap, uv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\r\n\r\n    #ifdef FLIP_SIDED\r\n\r\n      normal = - normal;\r\n\r\n    #endif\r\n\r\n    #ifdef DOUBLE_SIDED\r\n\r\n      // Temporary compat against shader change @ Three.js r126\r\n      // See: #21205, #21307, #21299\r\n      #ifdef THREE_VRM_THREE_REVISION_126\r\n\r\n        normal = normal * faceDirection;\r\n\r\n      #else\r\n\r\n        normal = normal * ( float( gl_FrontFacing ) * 2.0 - 1.0 );\r\n\r\n      #endif\r\n\r\n    #endif\r\n\r\n    normal = normalize( normalMatrix * normal );\r\n\r\n  #elif defined( TANGENTSPACE_NORMALMAP )\r\n\r\n    vec3 mapN = texture2D( normalMap, uv ).xyz * 2.0 - 1.0;\r\n    mapN.xy *= normalScale;\r\n\r\n    #ifdef USE_TANGENT\r\n\r\n      normal = normalize( vTBN * mapN );\r\n\r\n    #else\r\n\r\n      // Temporary compat against shader change @ Three.js r126\r\n      // See: #21205, #21307, #21299\r\n      #ifdef THREE_VRM_THREE_REVISION_126\r\n\r\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );\r\n\r\n      #else\r\n\r\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN );\r\n\r\n      #endif\r\n\r\n    #endif\r\n\r\n  #endif\r\n\r\n  // #include <emissivemap_fragment>\r\n  #ifdef USE_EMISSIVEMAP\r\n    totalEmissiveRadiance *= emissiveMapTexelToLinear( texture2D( emissiveMap, uv ) ).rgb;\r\n  #endif\r\n\r\n  #ifdef DEBUG_NORMAL\r\n    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );\r\n    return;\r\n  #endif\r\n\r\n  // -- MToon: lighting --------------------------------------------------------\r\n  // accumulation\r\n  // #include <lights_phong_fragment>\r\n  MToonMaterial material;\r\n\r\n  material.diffuseColor = diffuseColor.rgb;\r\n\r\n  material.shadeColor = shadeColor;\r\n  #ifdef USE_SHADETEXTURE\r\n    material.shadeColor *= shadeTextureTexelToLinear( texture2D( shadeTexture, uv ) ).rgb;\r\n  #endif\r\n\r\n  material.shadingGrade = 1.0;\r\n  #ifdef USE_SHADINGGRADETEXTURE\r\n    material.shadingGrade = 1.0 - shadingGradeRate * ( 1.0 - texture2D( shadingGradeTexture, uv ).r );\r\n  #endif\r\n\r\n  material.receiveShadow = receiveShadowRate;\r\n  #ifdef USE_RECEIVESHADOWTEXTURE\r\n    material.receiveShadow *= texture2D( receiveShadowTexture, uv ).a;\r\n  #endif\r\n\r\n  // #include <lights_fragment_begin>\r\n  GeometricContext geometry;\r\n\r\n  geometry.position = - vViewPosition;\r\n  geometry.normal = normal;\r\n  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\r\n\r\n  IncidentLight directLight;\r\n  vec3 lightingSum = vec3( 0.0 );\r\n\r\n  #if ( NUM_POINT_LIGHTS > 0 )\r\n    PointLight pointLight;\r\n\r\n    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\r\n    PointLightShadow pointLightShadow;\r\n    #endif\r\n\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\r\n      pointLight = pointLights[ i ];\r\n      getPointDirectLightIrradiance( pointLight, geometry, directLight );\r\n\r\n      float atten = 1.0;\r\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\r\n      pointLightShadow = pointLightShadows[ i ];\r\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\r\n      #endif\r\n\r\n      float shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\r\n      float lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\r\n      vec3 lighting = getLighting( directLight.color );\r\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\r\n      lightingSum += lighting;\r\n    }\r\n    #pragma unroll_loop_end\r\n  #endif\r\n\r\n  #if ( NUM_SPOT_LIGHTS > 0 )\r\n    SpotLight spotLight;\r\n\r\n    #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\r\n    SpotLightShadow spotLightShadow;\r\n    #endif\r\n\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\r\n      spotLight = spotLights[ i ];\r\n      getSpotDirectLightIrradiance( spotLight, geometry, directLight );\r\n\r\n      float atten = 1.0;\r\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\r\n      spotLightShadow = spotLightShadows[ i ];\r\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\r\n      #endif\r\n\r\n      float shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\r\n      float lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\r\n      vec3 lighting = getLighting( directLight.color );\r\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\r\n      lightingSum += lighting;\r\n    }\r\n    #pragma unroll_loop_end\r\n  #endif\r\n\r\n  #if ( NUM_DIR_LIGHTS > 0 )\r\n    DirectionalLight directionalLight;\r\n\r\n    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\r\n    DirectionalLightShadow directionalLightShadow;\r\n    #endif\r\n\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\r\n      directionalLight = directionalLights[ i ];\r\n      getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\r\n\r\n      float atten = 1.0;\r\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\r\n      directionalLightShadow = directionalLightShadows[ i ];\r\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\r\n      #endif\r\n\r\n      float shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\r\n      float lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\r\n      vec3 lighting = getLighting( directLight.color );\r\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\r\n      lightingSum += lighting;\r\n    }\r\n    #pragma unroll_loop_end\r\n  #endif\r\n\r\n  // #if defined( RE_IndirectDiffuse )\r\n  vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\r\n  irradiance += getLightProbeIrradiance( lightProbe, geometry );\r\n  #if ( NUM_HEMI_LIGHTS > 0 )\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\r\n      irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\r\n    }\r\n    #pragma unroll_loop_end\r\n  #endif\r\n  // #endif\r\n\r\n  // #include <lights_fragment_maps>\r\n  #ifdef USE_LIGHTMAP\r\n    vec4 lightMapTexel = texture2D( lightMap, vUv2 );\r\n    vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;\r\n    #ifndef PHYSICALLY_CORRECT_LIGHTS\r\n      lightMapIrradiance *= PI;\r\n    #endif\r\n    irradiance += lightMapIrradiance;\r\n  #endif\r\n\r\n  // #include <lights_fragment_end>\r\n  // RE_IndirectDiffuse here\r\n  reflectedLight.indirectDiffuse += indirectLightIntensity * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\r\n\r\n  // modulation\r\n  #include <aomap_fragment>\r\n\r\n  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\r\n\r\n  // The \"comment out if you want to PBR absolutely\" line\r\n  #ifndef DEBUG_LITSHADERATE\r\n    col = min(col, material.diffuseColor);\r\n  #endif\r\n\r\n  #if defined( OUTLINE ) && defined( OUTLINE_COLOR_MIXED )\r\n    gl_FragColor = vec4(\r\n      outlineColor.rgb * mix( vec3( 1.0 ), col, outlineLightingMix ),\r\n      diffuseColor.a\r\n    );\r\n    postCorrection();\r\n    return;\r\n  #endif\r\n\r\n  #ifdef DEBUG_LITSHADERATE\r\n    gl_FragColor = vec4( col, diffuseColor.a );\r\n    postCorrection();\r\n    return;\r\n  #endif\r\n\r\n  // -- MToon: parametric rim lighting -----------------------------------------\r\n  vec3 viewDir = normalize( vViewPosition );\r\n  vec3 rimMix = mix( vec3( 1.0 ), lightingSum + indirectLightIntensity * irradiance, rimLightingMix );\r\n  vec3 rim = rimColor * pow( saturate( 1.0 - dot( viewDir, normal ) + rimLift ), rimFresnelPower );\r\n  #ifdef USE_RIMTEXTURE\r\n    rim *= rimTextureTexelToLinear( texture2D( rimTexture, uv ) ).rgb;\r\n  #endif\r\n  col += rim;\r\n\r\n  // -- MToon: additive matcap -------------------------------------------------\r\n  #ifdef USE_SPHEREADD\r\n    {\r\n      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );\r\n      vec3 y = cross( viewDir, x ); // guaranteed to be normalized\r\n      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );\r\n      vec3 matcap = sphereAddTexelToLinear( texture2D( sphereAdd, sphereUv ) ).xyz;\r\n      col += matcap;\r\n    }\r\n  #endif\r\n\r\n  // -- MToon: Emission --------------------------------------------------------\r\n  col += totalEmissiveRadiance;\r\n\r\n  // #include <envmap_fragment>\r\n\r\n  // -- Almost done! -----------------------------------------------------------\r\n  gl_FragColor = vec4( col, diffuseColor.a );\r\n  postCorrection();\r\n}";

    /* tslint:disable:member-ordering */
    const TAU = 2.0 * Math.PI;
    exports.MToonMaterialCullMode = void 0;
    (function (MToonMaterialCullMode) {
        MToonMaterialCullMode[MToonMaterialCullMode["Off"] = 0] = "Off";
        MToonMaterialCullMode[MToonMaterialCullMode["Front"] = 1] = "Front";
        MToonMaterialCullMode[MToonMaterialCullMode["Back"] = 2] = "Back";
    })(exports.MToonMaterialCullMode || (exports.MToonMaterialCullMode = {}));
    exports.MToonMaterialDebugMode = void 0;
    (function (MToonMaterialDebugMode) {
        MToonMaterialDebugMode[MToonMaterialDebugMode["None"] = 0] = "None";
        MToonMaterialDebugMode[MToonMaterialDebugMode["Normal"] = 1] = "Normal";
        MToonMaterialDebugMode[MToonMaterialDebugMode["LitShadeRate"] = 2] = "LitShadeRate";
        MToonMaterialDebugMode[MToonMaterialDebugMode["UV"] = 3] = "UV";
    })(exports.MToonMaterialDebugMode || (exports.MToonMaterialDebugMode = {}));
    exports.MToonMaterialOutlineColorMode = void 0;
    (function (MToonMaterialOutlineColorMode) {
        MToonMaterialOutlineColorMode[MToonMaterialOutlineColorMode["FixedColor"] = 0] = "FixedColor";
        MToonMaterialOutlineColorMode[MToonMaterialOutlineColorMode["MixedLighting"] = 1] = "MixedLighting";
    })(exports.MToonMaterialOutlineColorMode || (exports.MToonMaterialOutlineColorMode = {}));
    exports.MToonMaterialOutlineWidthMode = void 0;
    (function (MToonMaterialOutlineWidthMode) {
        MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["None"] = 0] = "None";
        MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["WorldCoordinates"] = 1] = "WorldCoordinates";
        MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["ScreenCoordinates"] = 2] = "ScreenCoordinates";
    })(exports.MToonMaterialOutlineWidthMode || (exports.MToonMaterialOutlineWidthMode = {}));
    exports.MToonMaterialRenderMode = void 0;
    (function (MToonMaterialRenderMode) {
        MToonMaterialRenderMode[MToonMaterialRenderMode["Opaque"] = 0] = "Opaque";
        MToonMaterialRenderMode[MToonMaterialRenderMode["Cutout"] = 1] = "Cutout";
        MToonMaterialRenderMode[MToonMaterialRenderMode["Transparent"] = 2] = "Transparent";
        MToonMaterialRenderMode[MToonMaterialRenderMode["TransparentWithZWrite"] = 3] = "TransparentWithZWrite";
    })(exports.MToonMaterialRenderMode || (exports.MToonMaterialRenderMode = {}));
    /**
     * MToon is a material specification that has various features.
     * The spec and implementation are originally founded for Unity engine and this is a port of the material.
     *
     * See: https://github.com/Santarh/MToon
     */
    class MToonMaterial extends THREE__namespace.ShaderMaterial {
        constructor(parameters = {}) {
            super();
            /**
             * Readonly boolean that indicates this is a [[MToonMaterial]].
             */
            this.isMToonMaterial = true;
            this.cutoff = 0.5; // _Cutoff
            this.color = new THREE__namespace.Vector4(1.0, 1.0, 1.0, 1.0); // _Color
            this.shadeColor = new THREE__namespace.Vector4(0.97, 0.81, 0.86, 1.0); // _ShadeColor
            this.map = null; // _MainTex
            // eslint-disable-next-line @typescript-eslint/naming-convention
            this.mainTex_ST = new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
            this.shadeTexture = null; // _ShadeTexture
            // public shadeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadeTexture_ST (unused)
            this.normalMap = null; // _BumpMap. again, THIS IS _BumpMap
            this.normalMapType = THREE__namespace.TangentSpaceNormalMap; // Three.js requires this
            this.normalScale = new THREE__namespace.Vector2(1.0, 1.0); // _BumpScale, in Vector2
            // public bumpMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _BumpMap_ST (unused)
            this.receiveShadowRate = 1.0; // _ReceiveShadowRate
            this.receiveShadowTexture = null; // _ReceiveShadowTexture
            // public receiveShadowTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ReceiveShadowTexture_ST (unused)
            this.shadingGradeRate = 1.0; // _ShadingGradeRate
            this.shadingGradeTexture = null; // _ShadingGradeTexture
            // public shadingGradeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadingGradeTexture_ST (unused)
            this.shadeShift = 0.0; // _ShadeShift
            this.shadeToony = 0.9; // _ShadeToony
            this.lightColorAttenuation = 0.0; // _LightColorAttenuation
            this.indirectLightIntensity = 0.1; // _IndirectLightIntensity
            this.rimTexture = null; // _RimTexture
            this.rimColor = new THREE__namespace.Vector4(0.0, 0.0, 0.0, 1.0); // _RimColor
            this.rimLightingMix = 0.0; // _RimLightingMix
            this.rimFresnelPower = 1.0; // _RimFresnelPower
            this.rimLift = 0.0; // _RimLift
            this.sphereAdd = null; // _SphereAdd
            // public sphereAdd_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _SphereAdd_ST (unused)
            this.emissionColor = new THREE__namespace.Vector4(0.0, 0.0, 0.0, 1.0); // _EmissionColor
            this.emissiveMap = null; // _EmissionMap
            // public emissionMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _EmissionMap_ST (unused)
            this.outlineWidthTexture = null; // _OutlineWidthTexture
            // public outlineWidthTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _OutlineWidthTexture_ST (unused)
            this.outlineWidth = 0.5; // _OutlineWidth
            this.outlineScaledMaxDistance = 1.0; // _OutlineScaledMaxDistance
            this.outlineColor = new THREE__namespace.Vector4(0.0, 0.0, 0.0, 1.0); // _OutlineColor
            this.outlineLightingMix = 1.0; // _OutlineLightingMix
            this.uvAnimMaskTexture = null; // _UvAnimMaskTexture
            this.uvAnimScrollX = 0.0; // _UvAnimScrollX
            this.uvAnimScrollY = 0.0; // _UvAnimScrollY
            this.uvAnimRotation = 0.0; // _uvAnimRotation
            this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
            this._debugMode = exports.MToonMaterialDebugMode.None; // _DebugMode
            this._blendMode = exports.MToonMaterialRenderMode.Opaque; // _BlendMode
            this._outlineWidthMode = exports.MToonMaterialOutlineWidthMode.None; // _OutlineWidthMode
            this._outlineColorMode = exports.MToonMaterialOutlineColorMode.FixedColor; // _OutlineColorMode
            this._cullMode = exports.MToonMaterialCullMode.Back; // _CullMode
            this._outlineCullMode = exports.MToonMaterialCullMode.Front; // _OutlineCullMode
            // public srcBlend = 1.0; // _SrcBlend (is not supported)
            // public dstBlend = 0.0; // _DstBlend (is not supported)
            // public zWrite = 1.0; // _ZWrite (will be converted to depthWrite)
            this._isOutline = false;
            this._uvAnimOffsetX = 0.0;
            this._uvAnimOffsetY = 0.0;
            this._uvAnimPhase = 0.0;
            this.encoding = parameters.encoding || THREE__namespace.LinearEncoding;
            if (this.encoding !== THREE__namespace.LinearEncoding && this.encoding !== THREE__namespace.sRGBEncoding) {
                console.warn('The specified color encoding does not work properly with MToonMaterial. You might want to use THREE.sRGBEncoding instead.');
            }
            // == these parameter has no compatibility with this implementation ========
            [
                'mToonVersion',
                'shadeTexture_ST',
                'bumpMap_ST',
                'receiveShadowTexture_ST',
                'shadingGradeTexture_ST',
                'rimTexture_ST',
                'sphereAdd_ST',
                'emissionMap_ST',
                'outlineWidthTexture_ST',
                'uvAnimMaskTexture_ST',
                'srcBlend',
                'dstBlend',
            ].forEach((key) => {
                if (parameters[key] !== undefined) {
                    // console.warn(`THREE.${this.type}: The parameter "${key}" is not supported.`);
                    delete parameters[key];
                }
            });
            // == enabling bunch of stuff ==============================================
            parameters.fog = true;
            parameters.lights = true;
            parameters.clipping = true;
            parameters.skinning = parameters.skinning || false;
            parameters.morphTargets = parameters.morphTargets || false;
            parameters.morphNormals = parameters.morphNormals || false;
            // == uniforms =============================================================
            parameters.uniforms = THREE__namespace.UniformsUtils.merge([
                THREE__namespace.UniformsLib.common,
                THREE__namespace.UniformsLib.normalmap,
                THREE__namespace.UniformsLib.emissivemap,
                THREE__namespace.UniformsLib.fog,
                THREE__namespace.UniformsLib.lights,
                {
                    cutoff: { value: 0.5 },
                    color: { value: new THREE__namespace.Color(1.0, 1.0, 1.0) },
                    colorAlpha: { value: 1.0 },
                    shadeColor: { value: new THREE__namespace.Color(0.97, 0.81, 0.86) },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    mainTex_ST: { value: new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0) },
                    shadeTexture: { value: null },
                    receiveShadowRate: { value: 1.0 },
                    receiveShadowTexture: { value: null },
                    shadingGradeRate: { value: 1.0 },
                    shadingGradeTexture: { value: null },
                    shadeShift: { value: 0.0 },
                    shadeToony: { value: 0.9 },
                    lightColorAttenuation: { value: 0.0 },
                    indirectLightIntensity: { value: 0.1 },
                    rimTexture: { value: null },
                    rimColor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    rimLightingMix: { value: 0.0 },
                    rimFresnelPower: { value: 1.0 },
                    rimLift: { value: 0.0 },
                    sphereAdd: { value: null },
                    emissionColor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    outlineWidthTexture: { value: null },
                    outlineWidth: { value: 0.5 },
                    outlineScaledMaxDistance: { value: 1.0 },
                    outlineColor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    outlineLightingMix: { value: 1.0 },
                    uvAnimMaskTexture: { value: null },
                    uvAnimOffsetX: { value: 0.0 },
                    uvAnimOffsetY: { value: 0.0 },
                    uvAnimTheta: { value: 0.0 },
                },
            ]);
            // == finally compile the shader program ===================================
            this.setValues(parameters);
            // == update shader stuff ==================================================
            this._updateShaderCode();
            this._applyUniforms();
        }
        get mainTex() {
            return this.map;
        }
        set mainTex(t) {
            this.map = t;
        }
        get bumpMap() {
            return this.normalMap;
        }
        set bumpMap(t) {
            this.normalMap = t;
        }
        /**
         * Getting the `bumpScale` reutrns its x component of `normalScale` (assuming x and y component of `normalScale` are same).
         */
        get bumpScale() {
            return this.normalScale.x;
        }
        /**
         * Setting the `bumpScale` will be convert the value into Vector2 `normalScale` .
         */
        set bumpScale(t) {
            this.normalScale.set(t, t);
        }
        get emissionMap() {
            return this.emissiveMap;
        }
        set emissionMap(t) {
            this.emissiveMap = t;
        }
        get blendMode() {
            return this._blendMode;
        }
        set blendMode(m) {
            this._blendMode = m;
            this.depthWrite = this._blendMode !== exports.MToonMaterialRenderMode.Transparent;
            this.transparent =
                this._blendMode === exports.MToonMaterialRenderMode.Transparent ||
                    this._blendMode === exports.MToonMaterialRenderMode.TransparentWithZWrite;
            this._updateShaderCode();
        }
        get debugMode() {
            return this._debugMode;
        }
        set debugMode(m) {
            this._debugMode = m;
            this._updateShaderCode();
        }
        get outlineWidthMode() {
            return this._outlineWidthMode;
        }
        set outlineWidthMode(m) {
            this._outlineWidthMode = m;
            this._updateShaderCode();
        }
        get outlineColorMode() {
            return this._outlineColorMode;
        }
        set outlineColorMode(m) {
            this._outlineColorMode = m;
            this._updateShaderCode();
        }
        get cullMode() {
            return this._cullMode;
        }
        set cullMode(m) {
            this._cullMode = m;
            this._updateCullFace();
        }
        get outlineCullMode() {
            return this._outlineCullMode;
        }
        set outlineCullMode(m) {
            this._outlineCullMode = m;
            this._updateCullFace();
        }
        get zWrite() {
            return this.depthWrite ? 1 : 0;
        }
        set zWrite(i) {
            this.depthWrite = 0.5 <= i;
        }
        get isOutline() {
            return this._isOutline;
        }
        set isOutline(b) {
            this._isOutline = b;
            this._updateShaderCode();
            this._updateCullFace();
        }
        /**
         * Update this material.
         * Usually this will be called via [[VRM.update]] so you don't have to call this manually.
         *
         * @param delta deltaTime since last update
         */
        updateVRMMaterials(delta) {
            this._uvAnimOffsetX = this._uvAnimOffsetX + delta * this.uvAnimScrollX;
            this._uvAnimOffsetY = this._uvAnimOffsetY - delta * this.uvAnimScrollY; // Negative since t axis of uvs are opposite from Unity's one
            this._uvAnimPhase = this._uvAnimPhase + delta * this.uvAnimRotation;
            this._applyUniforms();
        }
        copy(source) {
            super.copy(source);
            // == copy members =========================================================
            this.cutoff = source.cutoff;
            this.color.copy(source.color);
            this.shadeColor.copy(source.shadeColor);
            this.map = source.map;
            this.mainTex_ST.copy(source.mainTex_ST);
            this.shadeTexture = source.shadeTexture;
            this.normalMap = source.normalMap;
            this.normalMapType = source.normalMapType;
            this.normalScale.copy(this.normalScale);
            this.receiveShadowRate = source.receiveShadowRate;
            this.receiveShadowTexture = source.receiveShadowTexture;
            this.shadingGradeRate = source.shadingGradeRate;
            this.shadingGradeTexture = source.shadingGradeTexture;
            this.shadeShift = source.shadeShift;
            this.shadeToony = source.shadeToony;
            this.lightColorAttenuation = source.lightColorAttenuation;
            this.indirectLightIntensity = source.indirectLightIntensity;
            this.rimTexture = source.rimTexture;
            this.rimColor.copy(source.rimColor);
            this.rimLightingMix = source.rimLightingMix;
            this.rimFresnelPower = source.rimFresnelPower;
            this.rimLift = source.rimLift;
            this.sphereAdd = source.sphereAdd;
            this.emissionColor.copy(source.emissionColor);
            this.emissiveMap = source.emissiveMap;
            this.outlineWidthTexture = source.outlineWidthTexture;
            this.outlineWidth = source.outlineWidth;
            this.outlineScaledMaxDistance = source.outlineScaledMaxDistance;
            this.outlineColor.copy(source.outlineColor);
            this.outlineLightingMix = source.outlineLightingMix;
            this.uvAnimMaskTexture = source.uvAnimMaskTexture;
            this.uvAnimScrollX = source.uvAnimScrollX;
            this.uvAnimScrollY = source.uvAnimScrollY;
            this.uvAnimRotation = source.uvAnimRotation;
            this.debugMode = source.debugMode;
            this.blendMode = source.blendMode;
            this.outlineWidthMode = source.outlineWidthMode;
            this.outlineColorMode = source.outlineColorMode;
            this.cullMode = source.cullMode;
            this.outlineCullMode = source.outlineCullMode;
            this.isOutline = source.isOutline;
            return this;
        }
        /**
         * Apply updated uniform variables.
         */
        _applyUniforms() {
            this.uniforms.uvAnimOffsetX.value = this._uvAnimOffsetX;
            this.uniforms.uvAnimOffsetY.value = this._uvAnimOffsetY;
            this.uniforms.uvAnimTheta.value = TAU * this._uvAnimPhase;
            if (!this.shouldApplyUniforms) {
                return;
            }
            this.shouldApplyUniforms = false;
            this.uniforms.cutoff.value = this.cutoff;
            this.uniforms.color.value.setRGB(this.color.x, this.color.y, this.color.z);
            this.uniforms.colorAlpha.value = this.color.w;
            this.uniforms.shadeColor.value.setRGB(this.shadeColor.x, this.shadeColor.y, this.shadeColor.z);
            this.uniforms.map.value = this.map;
            this.uniforms.mainTex_ST.value.copy(this.mainTex_ST);
            this.uniforms.shadeTexture.value = this.shadeTexture;
            this.uniforms.normalMap.value = this.normalMap;
            this.uniforms.normalScale.value.copy(this.normalScale);
            this.uniforms.receiveShadowRate.value = this.receiveShadowRate;
            this.uniforms.receiveShadowTexture.value = this.receiveShadowTexture;
            this.uniforms.shadingGradeRate.value = this.shadingGradeRate;
            this.uniforms.shadingGradeTexture.value = this.shadingGradeTexture;
            this.uniforms.shadeShift.value = this.shadeShift;
            this.uniforms.shadeToony.value = this.shadeToony;
            this.uniforms.lightColorAttenuation.value = this.lightColorAttenuation;
            this.uniforms.indirectLightIntensity.value = this.indirectLightIntensity;
            this.uniforms.rimTexture.value = this.rimTexture;
            this.uniforms.rimColor.value.setRGB(this.rimColor.x, this.rimColor.y, this.rimColor.z);
            this.uniforms.rimLightingMix.value = this.rimLightingMix;
            this.uniforms.rimFresnelPower.value = this.rimFresnelPower;
            this.uniforms.rimLift.value = this.rimLift;
            this.uniforms.sphereAdd.value = this.sphereAdd;
            this.uniforms.emissionColor.value.setRGB(this.emissionColor.x, this.emissionColor.y, this.emissionColor.z);
            this.uniforms.emissiveMap.value = this.emissiveMap;
            this.uniforms.outlineWidthTexture.value = this.outlineWidthTexture;
            this.uniforms.outlineWidth.value = this.outlineWidth;
            this.uniforms.outlineScaledMaxDistance.value = this.outlineScaledMaxDistance;
            this.uniforms.outlineColor.value.setRGB(this.outlineColor.x, this.outlineColor.y, this.outlineColor.z);
            this.uniforms.outlineLightingMix.value = this.outlineLightingMix;
            this.uniforms.uvAnimMaskTexture.value = this.uvAnimMaskTexture;
            // apply color space to uniform colors
            if (this.encoding === THREE__namespace.sRGBEncoding) {
                this.uniforms.color.value.convertSRGBToLinear();
                this.uniforms.shadeColor.value.convertSRGBToLinear();
                this.uniforms.rimColor.value.convertSRGBToLinear();
                this.uniforms.emissionColor.value.convertSRGBToLinear();
                this.uniforms.outlineColor.value.convertSRGBToLinear();
            }
            this._updateCullFace();
        }
        _updateShaderCode() {
            const useUvInVert = this.outlineWidthTexture !== null;
            const useUvInFrag = this.map !== null ||
                this.shadeTexture !== null ||
                this.receiveShadowTexture !== null ||
                this.shadingGradeTexture !== null ||
                this.rimTexture !== null ||
                this.uvAnimMaskTexture !== null;
            this.defines = {
                // Temporary compat against shader change @ Three.js r126
                // See: #21205, #21307, #21299
                THREE_VRM_THREE_REVISION_126: parseInt(THREE__namespace.REVISION) >= 126,
                OUTLINE: this._isOutline,
                BLENDMODE_OPAQUE: this._blendMode === exports.MToonMaterialRenderMode.Opaque,
                BLENDMODE_CUTOUT: this._blendMode === exports.MToonMaterialRenderMode.Cutout,
                BLENDMODE_TRANSPARENT: this._blendMode === exports.MToonMaterialRenderMode.Transparent ||
                    this._blendMode === exports.MToonMaterialRenderMode.TransparentWithZWrite,
                MTOON_USE_UV: useUvInVert || useUvInFrag,
                MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
                USE_SHADETEXTURE: this.shadeTexture !== null,
                USE_RECEIVESHADOWTEXTURE: this.receiveShadowTexture !== null,
                USE_SHADINGGRADETEXTURE: this.shadingGradeTexture !== null,
                USE_RIMTEXTURE: this.rimTexture !== null,
                USE_SPHEREADD: this.sphereAdd !== null,
                USE_OUTLINEWIDTHTEXTURE: this.outlineWidthTexture !== null,
                USE_UVANIMMASKTEXTURE: this.uvAnimMaskTexture !== null,
                DEBUG_NORMAL: this._debugMode === exports.MToonMaterialDebugMode.Normal,
                DEBUG_LITSHADERATE: this._debugMode === exports.MToonMaterialDebugMode.LitShadeRate,
                DEBUG_UV: this._debugMode === exports.MToonMaterialDebugMode.UV,
                OUTLINE_WIDTH_WORLD: this._outlineWidthMode === exports.MToonMaterialOutlineWidthMode.WorldCoordinates,
                OUTLINE_WIDTH_SCREEN: this._outlineWidthMode === exports.MToonMaterialOutlineWidthMode.ScreenCoordinates,
                OUTLINE_COLOR_FIXED: this._outlineColorMode === exports.MToonMaterialOutlineColorMode.FixedColor,
                OUTLINE_COLOR_MIXED: this._outlineColorMode === exports.MToonMaterialOutlineColorMode.MixedLighting,
            };
            // == texture encodings ====================================================
            const encodings = (this.shadeTexture !== null
                ? getTexelDecodingFunction('shadeTextureTexelToLinear', this.shadeTexture.encoding) + '\n'
                : '') +
                (this.sphereAdd !== null
                    ? getTexelDecodingFunction('sphereAddTexelToLinear', this.sphereAdd.encoding) + '\n'
                    : '') +
                (this.rimTexture !== null
                    ? getTexelDecodingFunction('rimTextureTexelToLinear', this.rimTexture.encoding) + '\n'
                    : '');
            // == generate shader code =================================================
            this.vertexShader = vertexShader$1;
            this.fragmentShader = encodings + fragmentShader$1;
            // == set needsUpdate flag =================================================
            this.needsUpdate = true;
        }
        _updateCullFace() {
            if (!this.isOutline) {
                if (this.cullMode === exports.MToonMaterialCullMode.Off) {
                    this.side = THREE__namespace.DoubleSide;
                }
                else if (this.cullMode === exports.MToonMaterialCullMode.Front) {
                    this.side = THREE__namespace.BackSide;
                }
                else if (this.cullMode === exports.MToonMaterialCullMode.Back) {
                    this.side = THREE__namespace.FrontSide;
                }
            }
            else {
                if (this.outlineCullMode === exports.MToonMaterialCullMode.Off) {
                    this.side = THREE__namespace.DoubleSide;
                }
                else if (this.outlineCullMode === exports.MToonMaterialCullMode.Front) {
                    this.side = THREE__namespace.BackSide;
                }
                else if (this.outlineCullMode === exports.MToonMaterialCullMode.Back) {
                    this.side = THREE__namespace.FrontSide;
                }
            }
        }
    }

    var vertexShader = "#include <common>\r\n\r\n// #include <uv_pars_vertex>\r\n#ifdef USE_MAP\r\n  varying vec2 vUv;\r\n  uniform vec4 mainTex_ST;\r\n#endif\r\n\r\n#include <uv2_pars_vertex>\r\n#include <envmap_pars_vertex>\r\n#include <color_pars_vertex>\r\n#include <fog_pars_vertex>\r\n#include <morphtarget_pars_vertex>\r\n#include <skinning_pars_vertex>\r\n#include <logdepthbuf_pars_vertex>\r\n#include <clipping_planes_pars_vertex>\r\n\r\nvoid main() {\r\n\r\n  // #include <uv_vertex>\r\n  #ifdef USE_MAP\r\n    vUv = vec2( mainTex_ST.p * uv.x + mainTex_ST.s, mainTex_ST.q * uv.y + mainTex_ST.t );\r\n  #endif\r\n\r\n  #include <uv2_vertex>\r\n  #include <color_vertex>\r\n  #include <skinbase_vertex>\r\n\r\n  #ifdef USE_ENVMAP\r\n\r\n  #include <beginnormal_vertex>\r\n  #include <morphnormal_vertex>\r\n  #include <skinnormal_vertex>\r\n  #include <defaultnormal_vertex>\r\n\r\n  #endif\r\n\r\n  #include <begin_vertex>\r\n  #include <morphtarget_vertex>\r\n  #include <skinning_vertex>\r\n  #include <project_vertex>\r\n  #include <logdepthbuf_vertex>\r\n\r\n  #include <worldpos_vertex>\r\n  #include <clipping_planes_vertex>\r\n  #include <envmap_vertex>\r\n  #include <fog_vertex>\r\n\r\n}";

    var fragmentShader = "#ifdef RENDERTYPE_CUTOUT\r\n  uniform float cutoff;\r\n#endif\r\n\r\n#include <common>\r\n#include <color_pars_fragment>\r\n#include <uv_pars_fragment>\r\n#include <uv2_pars_fragment>\r\n#include <map_pars_fragment>\r\n// #include <alphamap_pars_fragment>\r\n// #include <aomap_pars_fragment>\r\n// #include <lightmap_pars_fragment>\r\n// #include <envmap_pars_fragment>\r\n#include <fog_pars_fragment>\r\n// #include <specularmap_pars_fragment>\r\n#include <logdepthbuf_pars_fragment>\r\n#include <clipping_planes_pars_fragment>\r\n\r\n// == main procedure ===========================================================\r\nvoid main() {\r\n  #include <clipping_planes_fragment>\r\n\r\n  vec4 diffuseColor = vec4( 1.0 );\r\n\r\n  #include <logdepthbuf_fragment>\r\n\r\n  // #include <map_fragment>\r\n  #ifdef USE_MAP\r\n    diffuseColor *= mapTexelToLinear( texture2D( map, vUv ) );\r\n  #endif\r\n\r\n  #include <color_fragment>\r\n  // #include <alphamap_fragment>\r\n\r\n  // MToon: alpha\r\n  // #include <alphatest_fragment>\r\n  #ifdef RENDERTYPE_CUTOUT\r\n    if ( diffuseColor.a <= cutoff ) { discard; }\r\n    diffuseColor.a = 1.0;\r\n  #endif\r\n\r\n  #ifdef RENDERTYPE_OPAQUE\r\n    diffuseColor.a = 1.0;\r\n  #endif\r\n\r\n  // #include <specularmap_fragment>\r\n\r\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\r\n\r\n  // accumulation (baked indirect lighting only)\r\n  #ifdef USE_LIGHTMAP\r\n    reflectedLight.indirectDiffuse += texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\r\n  #else\r\n    reflectedLight.indirectDiffuse += vec3( 1.0 );\r\n  #endif\r\n\r\n  // modulation\r\n  // #include <aomap_fragment>\r\n\r\n  reflectedLight.indirectDiffuse *= diffuseColor.rgb;\r\n  vec3 outgoingLight = reflectedLight.indirectDiffuse;\r\n\r\n  // #include <envmap_fragment>\r\n\r\n  gl_FragColor = vec4( outgoingLight, diffuseColor.a );\r\n\r\n  #include <premultiplied_alpha_fragment>\r\n  #include <tonemapping_fragment>\r\n  #include <encodings_fragment>\r\n  #include <fog_fragment>\r\n}";

    /* tslint:disable:member-ordering */
    exports.VRMUnlitMaterialRenderType = void 0;
    (function (VRMUnlitMaterialRenderType) {
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Opaque"] = 0] = "Opaque";
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Cutout"] = 1] = "Cutout";
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Transparent"] = 2] = "Transparent";
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["TransparentWithZWrite"] = 3] = "TransparentWithZWrite";
    })(exports.VRMUnlitMaterialRenderType || (exports.VRMUnlitMaterialRenderType = {}));
    /**
     * This is a material that is an equivalent of "VRM/Unlit***" on VRM spec, those materials are already kinda deprecated though...
     */
    class VRMUnlitMaterial extends THREE__namespace.ShaderMaterial {
        constructor(parameters) {
            super();
            /**
             * Readonly boolean that indicates this is a [[VRMUnlitMaterial]].
             */
            this.isVRMUnlitMaterial = true;
            this.cutoff = 0.5;
            this.map = null; // _MainTex
            // eslint-disable-next-line @typescript-eslint/naming-convention
            this.mainTex_ST = new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
            this._renderType = exports.VRMUnlitMaterialRenderType.Opaque;
            this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
            if (parameters === undefined) {
                parameters = {};
            }
            // == enabling bunch of stuff ==============================================
            parameters.fog = true;
            parameters.clipping = true;
            parameters.skinning = parameters.skinning || false;
            parameters.morphTargets = parameters.morphTargets || false;
            parameters.morphNormals = parameters.morphNormals || false;
            // == uniforms =============================================================
            parameters.uniforms = THREE__namespace.UniformsUtils.merge([
                THREE__namespace.UniformsLib.common,
                THREE__namespace.UniformsLib.fog,
                {
                    cutoff: { value: 0.5 },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    mainTex_ST: { value: new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0) },
                },
            ]);
            // == finally compile the shader program ===================================
            this.setValues(parameters);
            // == update shader stuff ==================================================
            this._updateShaderCode();
            this._applyUniforms();
        }
        get mainTex() {
            return this.map;
        }
        set mainTex(t) {
            this.map = t;
        }
        get renderType() {
            return this._renderType;
        }
        set renderType(t) {
            this._renderType = t;
            this.depthWrite = this._renderType !== exports.VRMUnlitMaterialRenderType.Transparent;
            this.transparent =
                this._renderType === exports.VRMUnlitMaterialRenderType.Transparent ||
                    this._renderType === exports.VRMUnlitMaterialRenderType.TransparentWithZWrite;
            this._updateShaderCode();
        }
        /**
         * Update this material.
         * Usually this will be called via [[VRM.update]] so you don't have to call this manually.
         *
         * @param delta deltaTime since last update
         */
        updateVRMMaterials(delta) {
            this._applyUniforms();
        }
        copy(source) {
            super.copy(source);
            // == copy members =========================================================
            this.cutoff = source.cutoff;
            this.map = source.map;
            this.mainTex_ST.copy(source.mainTex_ST);
            this.renderType = source.renderType;
            return this;
        }
        /**
         * Apply updated uniform variables.
         */
        _applyUniforms() {
            if (!this.shouldApplyUniforms) {
                return;
            }
            this.shouldApplyUniforms = false;
            this.uniforms.cutoff.value = this.cutoff;
            this.uniforms.map.value = this.map;
            this.uniforms.mainTex_ST.value.copy(this.mainTex_ST);
        }
        _updateShaderCode() {
            this.defines = {
                RENDERTYPE_OPAQUE: this._renderType === exports.VRMUnlitMaterialRenderType.Opaque,
                RENDERTYPE_CUTOUT: this._renderType === exports.VRMUnlitMaterialRenderType.Cutout,
                RENDERTYPE_TRANSPARENT: this._renderType === exports.VRMUnlitMaterialRenderType.Transparent ||
                    this._renderType === exports.VRMUnlitMaterialRenderType.TransparentWithZWrite,
            };
            this.vertexShader = vertexShader;
            this.fragmentShader = fragmentShader;
            // == set needsUpdate flag =================================================
            this.needsUpdate = true;
        }
    }

    /**
     * An importer that imports VRM materials from a VRM extension of a GLTF.
     */
    class VRMMaterialImporter {
        /**
         * Create a new VRMMaterialImporter.
         *
         * @param options Options of the VRMMaterialImporter
         */
        constructor(options = {}) {
            this._encoding = options.encoding || THREE__namespace.LinearEncoding;
            if (this._encoding !== THREE__namespace.LinearEncoding && this._encoding !== THREE__namespace.sRGBEncoding) {
                console.warn('The specified color encoding might not work properly with VRMMaterialImporter. You might want to use THREE.sRGBEncoding instead.');
            }
            this._requestEnvMap = options.requestEnvMap;
        }
        /**
         * Convert all the materials of given GLTF based on VRM extension field `materialProperties`.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         */
        convertGLTFMaterials(gltf) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt) {
                    return null;
                }
                const materialProperties = vrmExt.materialProperties;
                if (!materialProperties) {
                    return null;
                }
                const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
                const materialList = {};
                const materials = []; // result
                yield Promise.all(Array.from(nodePrimitivesMap.entries()).map(([nodeIndex, primitives]) => __awaiter(this, void 0, void 0, function* () {
                    const schemaNode = gltf.parser.json.nodes[nodeIndex];
                    const schemaMesh = gltf.parser.json.meshes[schemaNode.mesh];
                    yield Promise.all(primitives.map((primitive, primitiveIndex) => __awaiter(this, void 0, void 0, function* () {
                        const schemaPrimitive = schemaMesh.primitives[primitiveIndex];
                        // some glTF might have both `node.mesh` and `node.children` at once
                        // and GLTFLoader handles both mesh primitives and "children" in glTF as "children" in THREE
                        // It seems GLTFLoader handles primitives first then handles "children" in glTF (it's lucky!)
                        // so we should ignore (primitives.length)th and following children of `mesh.children`
                        // TODO: sanitize this after GLTFLoader plugin system gets introduced : https://github.com/mrdoob/three.js/pull/18421
                        if (!schemaPrimitive) {
                            return;
                        }
                        const primitiveGeometry = primitive.geometry;
                        const primitiveVertices = primitiveGeometry.index
                            ? primitiveGeometry.index.count
                            : primitiveGeometry.attributes.position.count / 3;
                        // if primitives material is not an array, make it an array
                        if (!Array.isArray(primitive.material)) {
                            primitive.material = [primitive.material];
                            primitiveGeometry.addGroup(0, primitiveVertices, 0);
                        }
                        // create / push to cache (or pop from cache) vrm materials
                        const vrmMaterialIndex = schemaPrimitive.material;
                        let props = materialProperties[vrmMaterialIndex];
                        if (!props) {
                            console.warn(`VRMMaterialImporter: There are no material definition for material #${vrmMaterialIndex} on VRM extension.`);
                            props = { shader: 'VRM_USE_GLTFSHADER' }; // fallback
                        }
                        let vrmMaterials;
                        if (materialList[vrmMaterialIndex]) {
                            vrmMaterials = materialList[vrmMaterialIndex];
                        }
                        else {
                            vrmMaterials = yield this.createVRMMaterials(primitive.material[0], props, gltf);
                            materialList[vrmMaterialIndex] = vrmMaterials;
                            materials.push(vrmMaterials.surface);
                            if (vrmMaterials.outline) {
                                materials.push(vrmMaterials.outline);
                            }
                        }
                        // surface
                        primitive.material[0] = vrmMaterials.surface;
                        // envmap
                        if (this._requestEnvMap && vrmMaterials.surface.isMeshStandardMaterial) {
                            this._requestEnvMap().then((envMap) => {
                                vrmMaterials.surface.envMap = envMap;
                                vrmMaterials.surface.needsUpdate = true;
                            });
                        }
                        // render order
                        primitive.renderOrder = props.renderQueue || 2000;
                        // outline ("2 pass shading using groups" trick here)
                        if (vrmMaterials.outline) {
                            primitive.material[1] = vrmMaterials.outline;
                            primitiveGeometry.addGroup(0, primitiveVertices, 1);
                        }
                    })));
                })));
                return materials;
            });
        }
        createVRMMaterials(originalMaterial, vrmProps, gltf) {
            return __awaiter(this, void 0, void 0, function* () {
                let newSurface;
                let newOutline;
                if (vrmProps.shader === 'VRM/MToon') {
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    // we need to get rid of these properties
                    ['srcBlend', 'dstBlend', 'isFirstSetup'].forEach((name) => {
                        if (params[name] !== undefined) {
                            delete params[name];
                        }
                    });
                    // these textures must be sRGB Encoding, depends on current colorspace
                    ['mainTex', 'shadeTexture', 'emissionMap', 'sphereAdd', 'rimTexture'].forEach((name) => {
                        if (params[name] !== undefined) {
                            params[name].encoding = this._encoding;
                        }
                    });
                    // specify uniform color encodings
                    params.encoding = this._encoding;
                    // done
                    newSurface = new MToonMaterial(params);
                    // outline
                    if (params.outlineWidthMode !== exports.MToonMaterialOutlineWidthMode.None) {
                        params.isOutline = true;
                        newOutline = new MToonMaterial(params);
                    }
                }
                else if (vrmProps.shader === 'VRM/UnlitTexture') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.Opaque;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else if (vrmProps.shader === 'VRM/UnlitCutout') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.Cutout;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else if (vrmProps.shader === 'VRM/UnlitTransparent') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.Transparent;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else if (vrmProps.shader === 'VRM/UnlitTransparentZWrite') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.TransparentWithZWrite;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else {
                    if (vrmProps.shader !== 'VRM_USE_GLTFSHADER') {
                        console.warn(`Unknown shader detected: "${vrmProps.shader}"`);
                        // then presume as VRM_USE_GLTFSHADER
                    }
                    newSurface = this._convertGLTFMaterial(originalMaterial.clone());
                }
                newSurface.name = originalMaterial.name;
                newSurface.userData = JSON.parse(JSON.stringify(originalMaterial.userData));
                newSurface.userData.vrmMaterialProperties = vrmProps;
                if (newOutline) {
                    newOutline.name = originalMaterial.name + ' (Outline)';
                    newOutline.userData = JSON.parse(JSON.stringify(originalMaterial.userData));
                    newOutline.userData.vrmMaterialProperties = vrmProps;
                }
                return {
                    surface: newSurface,
                    outline: newOutline,
                };
            });
        }
        _renameMaterialProperty(name) {
            if (name[0] !== '_') {
                console.warn(`VRMMaterials: Given property name "${name}" might be invalid`);
                return name;
            }
            name = name.substring(1);
            if (!/[A-Z]/.test(name[0])) {
                console.warn(`VRMMaterials: Given property name "${name}" might be invalid`);
                return name;
            }
            return name[0].toLowerCase() + name.substring(1);
        }
        _convertGLTFMaterial(material) {
            if (material.isMeshStandardMaterial) {
                const mtl = material;
                if (mtl.map) {
                    mtl.map.encoding = this._encoding;
                }
                if (mtl.emissiveMap) {
                    mtl.emissiveMap.encoding = this._encoding;
                }
                if (this._encoding === THREE__namespace.LinearEncoding) {
                    mtl.color.convertLinearToSRGB();
                    mtl.emissive.convertLinearToSRGB();
                }
            }
            if (material.isMeshBasicMaterial) {
                const mtl = material;
                if (mtl.map) {
                    mtl.map.encoding = this._encoding;
                }
                if (this._encoding === THREE__namespace.LinearEncoding) {
                    mtl.color.convertLinearToSRGB();
                }
            }
            return material;
        }
        _extractMaterialProperties(originalMaterial, vrmProps, gltf) {
            const taskList = [];
            const params = {};
            // extract texture properties
            if (vrmProps.textureProperties) {
                for (const name of Object.keys(vrmProps.textureProperties)) {
                    const newName = this._renameMaterialProperty(name);
                    const textureIndex = vrmProps.textureProperties[name];
                    taskList.push(gltf.parser.getDependency('texture', textureIndex).then((texture) => {
                        params[newName] = texture;
                    }));
                }
            }
            // extract float properties
            if (vrmProps.floatProperties) {
                for (const name of Object.keys(vrmProps.floatProperties)) {
                    const newName = this._renameMaterialProperty(name);
                    params[newName] = vrmProps.floatProperties[name];
                }
            }
            // extract vector (color tbh) properties
            if (vrmProps.vectorProperties) {
                for (const name of Object.keys(vrmProps.vectorProperties)) {
                    let newName = this._renameMaterialProperty(name);
                    // if this is textureST (same name as texture name itself), add '_ST'
                    const isTextureST = [
                        '_MainTex',
                        '_ShadeTexture',
                        '_BumpMap',
                        '_ReceiveShadowTexture',
                        '_ShadingGradeTexture',
                        '_RimTexture',
                        '_SphereAdd',
                        '_EmissionMap',
                        '_OutlineWidthTexture',
                        '_UvAnimMaskTexture',
                    ].some((textureName) => name === textureName);
                    if (isTextureST) {
                        newName += '_ST';
                    }
                    params[newName] = new THREE__namespace.Vector4(...vrmProps.vectorProperties[name]);
                }
            }
            // set whether it needs skinning and morphing or not
            params.skinning = originalMaterial.skinning || false;
            params.morphTargets = originalMaterial.morphTargets || false;
            params.morphNormals = originalMaterial.morphNormals || false;
            return Promise.all(taskList).then(() => params);
        }
    }

    /**
     * An importer that imports a {@link VRMMeta} from a VRM extension of a GLTF.
     */
    class VRMMetaImporter {
        constructor(options) {
            var _a;
            this.ignoreTexture = (_a = options === null || options === void 0 ? void 0 : options.ignoreTexture) !== null && _a !== void 0 ? _a : false;
        }
        import(gltf) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt) {
                    return null;
                }
                const schemaMeta = vrmExt.meta;
                if (!schemaMeta) {
                    return null;
                }
                let texture;
                if (!this.ignoreTexture && schemaMeta.texture != null && schemaMeta.texture !== -1) {
                    texture = yield gltf.parser.getDependency('texture', schemaMeta.texture);
                }
                return {
                    allowedUserName: schemaMeta.allowedUserName,
                    author: schemaMeta.author,
                    commercialUssageName: schemaMeta.commercialUssageName,
                    contactInformation: schemaMeta.contactInformation,
                    licenseName: schemaMeta.licenseName,
                    otherLicenseUrl: schemaMeta.otherLicenseUrl,
                    otherPermissionUrl: schemaMeta.otherPermissionUrl,
                    reference: schemaMeta.reference,
                    sexualUssageName: schemaMeta.sexualUssageName,
                    texture: texture !== null && texture !== void 0 ? texture : undefined,
                    title: schemaMeta.title,
                    version: schemaMeta.version,
                    violentUssageName: schemaMeta.violentUssageName,
                };
            });
        }
    }

    const _matA$1 = new THREE__namespace.Matrix4();
    /**
     * A compat function for `Matrix4.invert()` / `Matrix4.getInverse()`.
     * `Matrix4.invert()` is introduced in r123 and `Matrix4.getInverse()` emits a warning.
     * We are going to use this compat for a while.
     * @param target A target matrix
     */
    function mat4InvertCompat(target) {
        if (target.invert) {
            target.invert();
        }
        else {
            target.getInverse(_matA$1.copy(target));
        }
        return target;
    }

    class Matrix4InverseCache {
        constructor(matrix) {
            /**
             * A cache of inverse of current matrix.
             */
            this._inverseCache = new THREE__namespace.Matrix4();
            /**
             * A flag that makes it want to recalculate its {@link _inverseCache}.
             * Will be set `true` when `elements` are mutated and be used in `getInverse`.
             */
            this._shouldUpdateInverse = true;
            this.matrix = matrix;
            const handler = {
                set: (obj, prop, newVal) => {
                    this._shouldUpdateInverse = true;
                    obj[prop] = newVal;
                    return true;
                },
            };
            this._originalElements = matrix.elements;
            matrix.elements = new Proxy(matrix.elements, handler);
        }
        /**
         * Inverse of given matrix.
         * Note that it will return its internal private instance.
         * Make sure copying this before mutate this.
         */
        get inverse() {
            if (this._shouldUpdateInverse) {
                mat4InvertCompat(this._inverseCache.copy(this.matrix));
                this._shouldUpdateInverse = false;
            }
            return this._inverseCache;
        }
        revert() {
            this.matrix.elements = this._originalElements;
        }
    }

    // based on
    // http://rocketjump.skr.jp/unity3d/109/
    // https://github.com/dwango/UniVRM/blob/master/Scripts/SpringBone/VRMSpringBone.cs
    const IDENTITY_MATRIX4 = Object.freeze(new THREE__namespace.Matrix4());
    const IDENTITY_QUATERNION = Object.freeze(new THREE__namespace.Quaternion());
    // 計算中の一時保存用変数（一度インスタンスを作ったらあとは使い回す）
    const _v3A$2 = new THREE__namespace.Vector3();
    const _v3B = new THREE__namespace.Vector3();
    const _v3C = new THREE__namespace.Vector3();
    const _quatA = new THREE__namespace.Quaternion();
    const _matA = new THREE__namespace.Matrix4();
    const _matB = new THREE__namespace.Matrix4();
    /**
     * A class represents a single spring bone of a VRM.
     * It should be managed by a [[VRMSpringBoneManager]].
     */
    class VRMSpringBone {
        /**
         * Create a new VRMSpringBone.
         *
         * @param bone An Object3D that will be attached to this bone
         * @param params Several parameters related to behavior of the spring bone
         */
        constructor(bone, params = {}) {
            var _a, _b, _c, _d, _e, _f;
            /**
             * Current position of child tail, in world unit. Will be used for verlet integration.
             */
            this._currentTail = new THREE__namespace.Vector3();
            /**
             * Previous position of child tail, in world unit. Will be used for verlet integration.
             */
            this._prevTail = new THREE__namespace.Vector3();
            /**
             * Next position of child tail, in world unit. Will be used for verlet integration.
             * Actually used only in [[update]] and it's kind of temporary variable.
             */
            this._nextTail = new THREE__namespace.Vector3();
            /**
             * Initial axis of the bone, in local unit.
             */
            this._boneAxis = new THREE__namespace.Vector3();
            /**
             * Position of this bone in relative space, kind of a temporary variable.
             */
            this._centerSpacePosition = new THREE__namespace.Vector3();
            /**
             * This springbone will be calculated based on the space relative from this object.
             * If this is `null`, springbone will be calculated in world space.
             */
            this._center = null;
            /**
             * Rotation of parent bone, in world unit.
             * We should update this constantly in [[update]].
             */
            this._parentWorldRotation = new THREE__namespace.Quaternion();
            /**
             * Initial state of the local matrix of the bone.
             */
            this._initialLocalMatrix = new THREE__namespace.Matrix4();
            /**
             * Initial state of the rotation of the bone.
             */
            this._initialLocalRotation = new THREE__namespace.Quaternion();
            /**
             * Initial state of the position of its child.
             */
            this._initialLocalChildPosition = new THREE__namespace.Vector3();
            this.bone = bone; // uniVRMでの parent
            this.bone.matrixAutoUpdate = false; // updateにより計算されるのでthree.js内での自動処理は不要
            this.radius = (_a = params.radius) !== null && _a !== void 0 ? _a : 0.02;
            this.stiffnessForce = (_b = params.stiffnessForce) !== null && _b !== void 0 ? _b : 1.0;
            this.gravityDir = params.gravityDir
                ? new THREE__namespace.Vector3().copy(params.gravityDir)
                : new THREE__namespace.Vector3().set(0.0, -1.0, 0.0);
            this.gravityPower = (_c = params.gravityPower) !== null && _c !== void 0 ? _c : 0.0;
            this.dragForce = (_d = params.dragForce) !== null && _d !== void 0 ? _d : 0.4;
            this.colliders = (_e = params.colliders) !== null && _e !== void 0 ? _e : [];
            this._centerSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
            this._initialLocalMatrix.copy(this.bone.matrix);
            this._initialLocalRotation.copy(this.bone.quaternion);
            if (this.bone.children.length === 0) {
                // 末端のボーン。子ボーンがいないため「自分の少し先」が子ボーンということにする
                // https://github.com/dwango/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/SpringBone/VRMSpringBone.cs#L246
                this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(0.07); // magic number! derives from original source
            }
            else {
                const firstChild = this.bone.children[0];
                this._initialLocalChildPosition.copy(firstChild.position);
            }
            this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition));
            this._prevTail.copy(this._currentTail);
            this._nextTail.copy(this._currentTail);
            this._boneAxis.copy(this._initialLocalChildPosition).normalize();
            this._centerSpaceBoneLength = _v3A$2
                .copy(this._initialLocalChildPosition)
                .applyMatrix4(this.bone.matrixWorld)
                .sub(this._centerSpacePosition)
                .length();
            this.center = (_f = params.center) !== null && _f !== void 0 ? _f : null;
        }
        get center() {
            return this._center;
        }
        set center(center) {
            var _a;
            // convert tails to world space
            this._getMatrixCenterToWorld(_matA);
            this._currentTail.applyMatrix4(_matA);
            this._prevTail.applyMatrix4(_matA);
            this._nextTail.applyMatrix4(_matA);
            // uninstall inverse cache
            if ((_a = this._center) === null || _a === void 0 ? void 0 : _a.userData.inverseCacheProxy) {
                this._center.userData.inverseCacheProxy.revert();
                delete this._center.userData.inverseCacheProxy;
            }
            // change the center
            this._center = center;
            // install inverse cache
            if (this._center) {
                if (!this._center.userData.inverseCacheProxy) {
                    this._center.userData.inverseCacheProxy = new Matrix4InverseCache(this._center.matrixWorld);
                }
            }
            // convert tails to center space
            this._getMatrixWorldToCenter(_matA);
            this._currentTail.applyMatrix4(_matA);
            this._prevTail.applyMatrix4(_matA);
            this._nextTail.applyMatrix4(_matA);
            // convert center space dependant state
            _matA.multiply(this.bone.matrixWorld); // 🔥 ??
            this._centerSpacePosition.setFromMatrixPosition(_matA);
            this._centerSpaceBoneLength = _v3A$2
                .copy(this._initialLocalChildPosition)
                .applyMatrix4(_matA)
                .sub(this._centerSpacePosition)
                .length();
        }
        /**
         * Reset the state of this bone.
         * You might want to call [[VRMSpringBoneManager.reset]] instead.
         */
        reset() {
            this.bone.quaternion.copy(this._initialLocalRotation);
            // We need to update its matrixWorld manually, since we tweaked the bone by our hand
            this.bone.updateMatrix();
            this.bone.matrixWorld.multiplyMatrices(this._getParentMatrixWorld(), this.bone.matrix);
            this._centerSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
            // Apply updated position to tail states
            this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition));
            this._prevTail.copy(this._currentTail);
            this._nextTail.copy(this._currentTail);
        }
        /**
         * Update the state of this bone.
         * You might want to call [[VRMSpringBoneManager.update]] instead.
         *
         * @param delta deltaTime
         */
        update(delta) {
            if (delta <= 0)
                return;
            // 親スプリングボーンの姿勢は常に変化している。
            // それに基づいて処理直前に自分のworldMatrixを更新しておく
            this.bone.matrixWorld.multiplyMatrices(this._getParentMatrixWorld(), this.bone.matrix);
            if (this.bone.parent) {
                // SpringBoneは親から順に処理されていくため、
                // 親のmatrixWorldは最新状態の前提でworldMatrixからquaternionを取り出す。
                // 制限はあるけれど、計算は少ないのでgetWorldQuaternionではなくこの方法を取る。
                getWorldQuaternionLite(this.bone.parent, this._parentWorldRotation);
            }
            else {
                this._parentWorldRotation.copy(IDENTITY_QUATERNION);
            }
            // Get bone position in center space
            this._getMatrixWorldToCenter(_matA);
            _matA.multiply(this.bone.matrixWorld); // 🔥 ??
            this._centerSpacePosition.setFromMatrixPosition(_matA);
            // Get parent position in center space
            this._getMatrixWorldToCenter(_matB);
            _matB.multiply(this._getParentMatrixWorld());
            // several parameters
            const stiffness = this.stiffnessForce * delta;
            const external = _v3B.copy(this.gravityDir).multiplyScalar(this.gravityPower * delta);
            // verlet積分で次の位置を計算
            this._nextTail
                .copy(this._currentTail)
                .add(_v3A$2
                .copy(this._currentTail)
                .sub(this._prevTail)
                .multiplyScalar(1 - this.dragForce)) // 前フレームの移動を継続する(減衰もあるよ)
                .add(_v3A$2
                .copy(this._boneAxis)
                .applyMatrix4(this._initialLocalMatrix)
                .applyMatrix4(_matB)
                .sub(this._centerSpacePosition)
                .normalize()
                .multiplyScalar(stiffness)) // 親の回転による子ボーンの移動目標
                .add(external); // 外力による移動量
            // normalize bone length
            this._nextTail
                .sub(this._centerSpacePosition)
                .normalize()
                .multiplyScalar(this._centerSpaceBoneLength)
                .add(this._centerSpacePosition);
            // Collisionで移動
            this._collision(this._nextTail);
            this._prevTail.copy(this._currentTail);
            this._currentTail.copy(this._nextTail);
            // Apply rotation, convert vector3 thing into actual quaternion
            // Original UniVRM is doing world unit calculus at here but we're gonna do this on local unit
            // since Three.js is not good at world coordination stuff
            const initialCenterSpaceMatrixInv = mat4InvertCompat(_matA.copy(_matB.multiply(this._initialLocalMatrix)));
            const applyRotation = _quatA.setFromUnitVectors(this._boneAxis, _v3A$2.copy(this._nextTail).applyMatrix4(initialCenterSpaceMatrixInv).normalize());
            this.bone.quaternion.copy(this._initialLocalRotation).multiply(applyRotation);
            // We need to update its matrixWorld manually, since we tweaked the bone by our hand
            this.bone.updateMatrix();
            this.bone.matrixWorld.multiplyMatrices(this._getParentMatrixWorld(), this.bone.matrix);
        }
        /**
         * Do collision math against every colliders attached to this bone.
         *
         * @param tail The tail you want to process
         */
        _collision(tail) {
            this.colliders.forEach((collider) => {
                this._getMatrixWorldToCenter(_matA);
                _matA.multiply(collider.matrixWorld);
                const colliderCenterSpacePosition = _v3A$2.setFromMatrixPosition(_matA);
                const colliderRadius = collider.geometry.boundingSphere.radius; // the bounding sphere is guaranteed to be exist by VRMSpringBoneImporter._createColliderMesh
                const r = this.radius + colliderRadius;
                if (tail.distanceToSquared(colliderCenterSpacePosition) <= r * r) {
                    // ヒット。Colliderの半径方向に押し出す
                    const normal = _v3B.subVectors(tail, colliderCenterSpacePosition).normalize();
                    const posFromCollider = _v3C.addVectors(colliderCenterSpacePosition, normal.multiplyScalar(r));
                    // normalize bone length
                    tail.copy(posFromCollider
                        .sub(this._centerSpacePosition)
                        .normalize()
                        .multiplyScalar(this._centerSpaceBoneLength)
                        .add(this._centerSpacePosition));
                }
            });
        }
        /**
         * Create a matrix that converts center space into world space.
         * @param target Target matrix
         */
        _getMatrixCenterToWorld(target) {
            if (this._center) {
                target.copy(this._center.matrixWorld);
            }
            else {
                target.identity();
            }
            return target;
        }
        /**
         * Create a matrix that converts world space into center space.
         * @param target Target matrix
         */
        _getMatrixWorldToCenter(target) {
            if (this._center) {
                target.copy(this._center.userData.inverseCacheProxy.inverse);
            }
            else {
                target.identity();
            }
            return target;
        }
        /**
         * Returns the world matrix of its parent object.
         */
        _getParentMatrixWorld() {
            return this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY_MATRIX4;
        }
    }

    /**
     * A class manages every spring bones on a VRM.
     */
    class VRMSpringBoneManager {
        /**
         * Create a new [[VRMSpringBoneManager]]
         *
         * @param springBoneGroupList An array of [[VRMSpringBoneGroup]]
         */
        constructor(colliderGroups, springBoneGroupList) {
            this.colliderGroups = [];
            this.springBoneGroupList = [];
            this.colliderGroups = colliderGroups;
            this.springBoneGroupList = springBoneGroupList;
        }
        /**
         * Set all bones be calculated based on the space relative from this object.
         * If `null` is given, springbone will be calculated in world space.
         * @param root Root object, or `null`
         */
        setCenter(root) {
            this.springBoneGroupList.forEach((springBoneGroup) => {
                springBoneGroup.forEach((springBone) => {
                    springBone.center = root;
                });
            });
        }
        /**
         * Update every spring bone attached to this manager.
         *
         * @param delta deltaTime
         */
        lateUpdate(delta) {
            this.springBoneGroupList.forEach((springBoneGroup) => {
                springBoneGroup.forEach((springBone) => {
                    springBone.update(delta);
                });
            });
        }
        /**
         * Reset every spring bone attached to this manager.
         */
        reset() {
            this.springBoneGroupList.forEach((springBoneGroup) => {
                springBoneGroup.forEach((springBone) => {
                    springBone.reset();
                });
            });
        }
    }

    const _v3A$1 = new THREE__namespace.Vector3();
    const _colliderMaterial = new THREE__namespace.MeshBasicMaterial({ visible: false });
    /**
     * An importer that imports a [[VRMSpringBoneManager]] from a VRM extension of a GLTF.
     */
    class VRMSpringBoneImporter {
        /**
         * Import a [[VRMLookAtHead]] from a VRM.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         */
        import(gltf) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt)
                    return null;
                const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
                if (!schemaSecondaryAnimation)
                    return null;
                // 衝突判定球体メッシュ。
                const colliderGroups = yield this._importColliderMeshGroups(gltf, schemaSecondaryAnimation);
                // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
                // 一列だけではないことに注意。
                const springBoneGroupList = yield this._importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups);
                return new VRMSpringBoneManager(colliderGroups, springBoneGroupList);
            });
        }
        _createSpringBone(bone, params = {}) {
            return new VRMSpringBone(bone, params);
        }
        _importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups) {
            return __awaiter(this, void 0, void 0, function* () {
                const springBoneGroups = schemaSecondaryAnimation.boneGroups || [];
                const springBoneGroupList = [];
                yield Promise.all(springBoneGroups.map((vrmBoneGroup) => __awaiter(this, void 0, void 0, function* () {
                    if (vrmBoneGroup.stiffiness === undefined ||
                        vrmBoneGroup.gravityDir === undefined ||
                        vrmBoneGroup.gravityDir.x === undefined ||
                        vrmBoneGroup.gravityDir.y === undefined ||
                        vrmBoneGroup.gravityDir.z === undefined ||
                        vrmBoneGroup.gravityPower === undefined ||
                        vrmBoneGroup.dragForce === undefined ||
                        vrmBoneGroup.hitRadius === undefined ||
                        vrmBoneGroup.colliderGroups === undefined ||
                        vrmBoneGroup.bones === undefined ||
                        vrmBoneGroup.center === undefined) {
                        return;
                    }
                    const stiffnessForce = vrmBoneGroup.stiffiness;
                    const gravityDir = new THREE__namespace.Vector3(vrmBoneGroup.gravityDir.x, vrmBoneGroup.gravityDir.y, -vrmBoneGroup.gravityDir.z);
                    const gravityPower = vrmBoneGroup.gravityPower;
                    const dragForce = vrmBoneGroup.dragForce;
                    const radius = vrmBoneGroup.hitRadius;
                    const colliders = [];
                    vrmBoneGroup.colliderGroups.forEach((colliderIndex) => {
                        colliders.push(...colliderGroups[colliderIndex].colliders);
                    });
                    const springBoneGroup = [];
                    yield Promise.all(vrmBoneGroup.bones.map((nodeIndex) => __awaiter(this, void 0, void 0, function* () {
                        // VRMの情報から「揺れモノ」ボーンのルートが取れる
                        const springRootBone = yield gltf.parser.getDependency('node', nodeIndex);
                        const center = vrmBoneGroup.center !== -1 ? yield gltf.parser.getDependency('node', vrmBoneGroup.center) : null;
                        // it's weird but there might be cases we can't find the root bone
                        if (!springRootBone) {
                            return;
                        }
                        springRootBone.traverse((bone) => {
                            const springBone = this._createSpringBone(bone, {
                                radius,
                                stiffnessForce,
                                gravityDir,
                                gravityPower,
                                dragForce,
                                colliders,
                                center,
                            });
                            springBoneGroup.push(springBone);
                        });
                    })));
                    springBoneGroupList.push(springBoneGroup);
                })));
                return springBoneGroupList;
            });
        }
        /**
         * Create an array of [[VRMSpringBoneColliderGroup]].
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         * @param schemaSecondaryAnimation A `secondaryAnimation` field of VRM
         */
        _importColliderMeshGroups(gltf, schemaSecondaryAnimation) {
            return __awaiter(this, void 0, void 0, function* () {
                const vrmColliderGroups = schemaSecondaryAnimation.colliderGroups;
                if (vrmColliderGroups === undefined)
                    return [];
                const colliderGroups = [];
                vrmColliderGroups.forEach((colliderGroup) => __awaiter(this, void 0, void 0, function* () {
                    if (colliderGroup.node === undefined || colliderGroup.colliders === undefined) {
                        return;
                    }
                    const bone = yield gltf.parser.getDependency('node', colliderGroup.node);
                    const colliders = [];
                    colliderGroup.colliders.forEach((collider) => {
                        if (collider.offset === undefined ||
                            collider.offset.x === undefined ||
                            collider.offset.y === undefined ||
                            collider.offset.z === undefined ||
                            collider.radius === undefined) {
                            return;
                        }
                        const offset = _v3A$1.set(collider.offset.x, collider.offset.y, -collider.offset.z);
                        const colliderMesh = this._createColliderMesh(collider.radius, offset);
                        bone.add(colliderMesh);
                        colliders.push(colliderMesh);
                    });
                    const colliderMeshGroup = {
                        node: colliderGroup.node,
                        colliders,
                    };
                    colliderGroups.push(colliderMeshGroup);
                }));
                return colliderGroups;
            });
        }
        /**
         * Create a collider mesh.
         *
         * @param radius Radius of the new collider mesh
         * @param offset Offest of the new collider mesh
         */
        _createColliderMesh(radius, offset) {
            const colliderMesh = new THREE__namespace.Mesh(new THREE__namespace.SphereBufferGeometry(radius, 8, 4), _colliderMaterial);
            colliderMesh.position.copy(offset);
            // the name have to be this in order to exclude colliders from bounding box
            // (See Viewer.ts, search for child.name === 'vrmColliderSphere')
            colliderMesh.name = 'vrmColliderSphere';
            // We will use the radius of the sphere for collision vs bones.
            // `boundingSphere` must be created to compute the radius.
            colliderMesh.geometry.computeBoundingSphere();
            return colliderMesh;
        }
    }

    /**
     * An importer that imports a [[VRM]] from a VRM extension of a GLTF.
     */
    class VRMImporter {
        /**
         * Create a new VRMImporter.
         *
         * @param options [[VRMImporterOptions]], optionally contains importers for each component
         */
        constructor(options = {}) {
            this._metaImporter = options.metaImporter || new VRMMetaImporter();
            this._blendShapeImporter = options.blendShapeImporter || new VRMBlendShapeImporter();
            this._lookAtImporter = options.lookAtImporter || new VRMLookAtImporter();
            this._humanoidImporter = options.humanoidImporter || new VRMHumanoidImporter();
            this._firstPersonImporter = options.firstPersonImporter || new VRMFirstPersonImporter();
            this._materialImporter = options.materialImporter || new VRMMaterialImporter();
            this._springBoneImporter = options.springBoneImporter || new VRMSpringBoneImporter();
        }
        /**
         * Receive a GLTF object retrieved from `THREE.GLTFLoader` and create a new [[VRM]] instance.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         */
        import(gltf) {
            return __awaiter(this, void 0, void 0, function* () {
                if (gltf.parser.json.extensions === undefined || gltf.parser.json.extensions.VRM === undefined) {
                    throw new Error('Could not find VRM extension on the GLTF');
                }
                const scene = gltf.scene;
                scene.updateMatrixWorld(false);
                // Skinned object should not be frustumCulled
                // Since pre-skinned position might be outside of view
                scene.traverse((object3d) => {
                    if (object3d.isMesh) {
                        object3d.frustumCulled = false;
                    }
                });
                const meta = (yield this._metaImporter.import(gltf)) || undefined;
                const materials = (yield this._materialImporter.convertGLTFMaterials(gltf)) || undefined;
                const humanoid = (yield this._humanoidImporter.import(gltf)) || undefined;
                const firstPerson = humanoid ? (yield this._firstPersonImporter.import(gltf, humanoid)) || undefined : undefined;
                const blendShapeProxy = (yield this._blendShapeImporter.import(gltf)) || undefined;
                const lookAt = firstPerson && blendShapeProxy && humanoid
                    ? (yield this._lookAtImporter.import(gltf, firstPerson, blendShapeProxy, humanoid)) || undefined
                    : undefined;
                const springBoneManager = (yield this._springBoneImporter.import(gltf)) || undefined;
                return new VRM({
                    scene: gltf.scene,
                    meta,
                    materials,
                    humanoid,
                    firstPerson,
                    blendShapeProxy,
                    lookAt,
                    springBoneManager,
                });
            });
        }
    }

    /**
     * A class that represents a single VRM model.
     * See the documentation of [[VRM.from]] for the most basic use of VRM.
     */
    class VRM {
        /**
         * Create a new VRM instance.
         *
         * @param params [[VRMParameters]] that represents components of the VRM
         */
        constructor(params) {
            this.scene = params.scene;
            this.humanoid = params.humanoid;
            this.blendShapeProxy = params.blendShapeProxy;
            this.firstPerson = params.firstPerson;
            this.lookAt = params.lookAt;
            this.materials = params.materials;
            this.springBoneManager = params.springBoneManager;
            this.meta = params.meta;
        }
        /**
         * Create a new VRM from a parsed result of GLTF taken from GLTFLoader.
         * It's probably a thing what you want to get started with VRMs.
         *
         * @example Most basic use of VRM
         * ```
         * const scene = new THREE.Scene();
         *
         * new THREE.GLTFLoader().load( 'models/three-vrm-girl.vrm', ( gltf ) => {
         *
         *   THREE.VRM.from( gltf ).then( ( vrm ) => {
         *
         *     scene.add( vrm.scene );
         *
         *   } );
         *
         * } );
         * ```
         *
         * @param gltf A parsed GLTF object taken from GLTFLoader
         * @param options Options that will be used in importer
         */
        static from(gltf, options = {}) {
            return __awaiter(this, void 0, void 0, function* () {
                const importer = new VRMImporter(options);
                return yield importer.import(gltf);
            });
        }
        /**
         * **You need to call this on your update loop.**
         *
         * This function updates every VRM components.
         *
         * @param delta deltaTime
         */
        update(delta) {
            if (this.lookAt) {
                this.lookAt.update(delta);
            }
            if (this.blendShapeProxy) {
                this.blendShapeProxy.update();
            }
            if (this.springBoneManager) {
                this.springBoneManager.lateUpdate(delta);
            }
            if (this.materials) {
                this.materials.forEach((material) => {
                    if (material.updateVRMMaterials) {
                        material.updateVRMMaterials(delta);
                    }
                });
            }
        }
        /**
         * Dispose everything about the VRM instance.
         */
        dispose() {
            var _a, _b;
            const scene = this.scene;
            if (scene) {
                deepDispose(scene);
            }
            (_b = (_a = this.meta) === null || _a === void 0 ? void 0 : _a.texture) === null || _b === void 0 ? void 0 : _b.dispose();
        }
    }

    const _v2A = new THREE__namespace.Vector2();
    const _camera = new THREE__namespace.OrthographicCamera(-1, 1, -1, 1, -1, 1);
    const _material = new THREE__namespace.MeshBasicMaterial({ color: 0xffffff, side: THREE__namespace.DoubleSide });
    const _plane = new THREE__namespace.Mesh(new THREE__namespace.PlaneBufferGeometry(2, 2), _material);
    const _scene = new THREE__namespace.Scene();
    _scene.add(_plane);
    /**
     * Extract a thumbnail image blob from a {@link VRM}.
     * If the vrm does not have a thumbnail, it will throw an error.
     * @param renderer Renderer
     * @param vrm VRM with a thumbnail
     * @param size width / height of the image
     */
    function extractThumbnailBlob(renderer, vrm, size = 512) {
        var _a;
        // get the texture
        const texture = (_a = vrm.meta) === null || _a === void 0 ? void 0 : _a.texture;
        if (!texture) {
            throw new Error('extractThumbnailBlob: This VRM does not have a thumbnail');
        }
        const canvas = renderer.getContext().canvas;
        // store the current resolution
        renderer.getSize(_v2A);
        const prevWidth = _v2A.x;
        const prevHeight = _v2A.y;
        // overwrite the resolution
        renderer.setSize(size, size, false);
        // assign the texture to plane
        _material.map = texture;
        // render
        renderer.render(_scene, _camera);
        // unassign the texture
        _material.map = null;
        // get blob
        if (canvas instanceof OffscreenCanvas) {
            return canvas.convertToBlob().finally(() => {
                // revert to previous resolution
                renderer.setSize(prevWidth, prevHeight, false);
            });
        }
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                // revert to previous resolution
                renderer.setSize(prevWidth, prevHeight, false);
                if (blob == null) {
                    reject('extractThumbnailBlob: Failed to create a blob');
                }
                else {
                    resolve(blob);
                }
            });
        });
    }

    /**
     * Traverse given object and remove unnecessarily bound joints from every `THREE.SkinnedMesh`.
     * Some environments like mobile devices have a lower limit of bones and might be unable to perform mesh skinning, this function might resolve such an issue.
     * Also this function might greatly improve the performance of mesh skinning.
     *
     * @param root Root object that will be traversed
     */
    function removeUnnecessaryJoints(root) {
        // some meshes might share a same skinIndex attribute and this map prevents to convert the attribute twice
        const skeletonList = new Map();
        // Traverse an entire tree
        root.traverse((obj) => {
            if (obj.type !== 'SkinnedMesh') {
                return;
            }
            const mesh = obj;
            const geometry = mesh.geometry;
            const attribute = geometry.getAttribute('skinIndex');
            // look for existing skeleton
            let skeleton = skeletonList.get(attribute);
            if (!skeleton) {
                // generate reduced bone list
                const bones = []; // new list of bone
                const boneInverses = []; // new list of boneInverse
                const boneIndexMap = {}; // map of old bone index vs. new bone index
                // create a new bone map
                const array = attribute.array;
                for (let i = 0; i < array.length; i++) {
                    const index = array[i];
                    // new skinIndex buffer
                    if (boneIndexMap[index] === undefined) {
                        boneIndexMap[index] = bones.length;
                        bones.push(mesh.skeleton.bones[index]);
                        boneInverses.push(mesh.skeleton.boneInverses[index]);
                    }
                    array[i] = boneIndexMap[index];
                }
                // replace with new indices
                attribute.copyArray(array);
                attribute.needsUpdate = true;
                // replace with new indices
                skeleton = new THREE__namespace.Skeleton(bones, boneInverses);
                skeletonList.set(attribute, skeleton);
            }
            mesh.bind(skeleton, new THREE__namespace.Matrix4());
            //                  ^^^^^^^^^^^^^^^^^^^ transform of meshes should be ignored
            // See: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
        });
    }

    class VRMUtils {
        constructor() {
            // this class is not meant to be instantiated
        }
    }
    VRMUtils.extractThumbnailBlob = extractThumbnailBlob;
    VRMUtils.removeUnnecessaryJoints = removeUnnecessaryJoints;

    const _v3 = new THREE__namespace.Vector3();
    class VRMLookAtHeadDebug extends VRMLookAtHead {
        setupHelper(scene, debugOption) {
            if (!debugOption.disableFaceDirectionHelper) {
                this._faceDirectionHelper = new THREE__namespace.ArrowHelper(new THREE__namespace.Vector3(0, 0, -1), new THREE__namespace.Vector3(0, 0, 0), 0.5, 0xff00ff);
                scene.add(this._faceDirectionHelper);
            }
        }
        update(delta) {
            super.update(delta);
            if (this._faceDirectionHelper) {
                this.firstPerson.getFirstPersonWorldPosition(this._faceDirectionHelper.position);
                this._faceDirectionHelper.setDirection(this.getLookAtWorldDirection(_v3));
            }
        }
    }

    class VRMLookAtImporterDebug extends VRMLookAtImporter {
        import(gltf, firstPerson, blendShapeProxy, humanoid) {
            var _a;
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaFirstPerson = vrmExt.firstPerson;
            if (!schemaFirstPerson) {
                return null;
            }
            const applyer = this._importApplyer(schemaFirstPerson, blendShapeProxy, humanoid);
            return new VRMLookAtHeadDebug(firstPerson, applyer || undefined);
        }
    }

    const _colliderGizmoMaterial = new THREE__namespace.MeshBasicMaterial({
        color: 0xff00ff,
        wireframe: true,
        transparent: true,
        depthTest: false,
    });
    class VRMSpringBoneManagerDebug extends VRMSpringBoneManager {
        setupHelper(scene, debugOption) {
            if (debugOption.disableSpringBoneHelper)
                return;
            this.springBoneGroupList.forEach((springBoneGroup) => {
                springBoneGroup.forEach((springBone) => {
                    if (springBone.getGizmo) {
                        const gizmo = springBone.getGizmo();
                        scene.add(gizmo);
                    }
                });
            });
            this.colliderGroups.forEach((colliderGroup) => {
                colliderGroup.colliders.forEach((collider) => {
                    collider.material = _colliderGizmoMaterial;
                    collider.renderOrder = VRM_GIZMO_RENDER_ORDER;
                });
            });
        }
    }

    const _v3A = new THREE__namespace.Vector3();
    class VRMSpringBoneDebug extends VRMSpringBone {
        constructor(bone, params) {
            super(bone, params);
        }
        /**
         * Return spring bone gizmo, as `THREE.ArrowHelper`.
         * Useful for debugging spring bones.
         */
        getGizmo() {
            // return if gizmo is already existed
            if (this._gizmo) {
                return this._gizmo;
            }
            const nextTailRelative = _v3A.copy(this._nextTail).sub(this._centerSpacePosition);
            const nextTailRelativeLength = nextTailRelative.length();
            this._gizmo = new THREE__namespace.ArrowHelper(nextTailRelative.normalize(), this._centerSpacePosition, nextTailRelativeLength, 0xffff00, this.radius, this.radius);
            // it should be always visible
            this._gizmo.line.renderOrder = VRM_GIZMO_RENDER_ORDER;
            this._gizmo.cone.renderOrder = VRM_GIZMO_RENDER_ORDER;
            this._gizmo.line.material.depthTest = false;
            this._gizmo.line.material.transparent = true;
            this._gizmo.cone.material.depthTest = false;
            this._gizmo.cone.material.transparent = true;
            return this._gizmo;
        }
        update(delta) {
            super.update(delta);
            // lastly we're gonna update gizmo
            this._updateGizmo();
        }
        _updateGizmo() {
            if (!this._gizmo) {
                return;
            }
            const nextTailRelative = _v3A.copy(this._currentTail).sub(this._centerSpacePosition);
            const nextTailRelativeLength = nextTailRelative.length();
            this._gizmo.setDirection(nextTailRelative.normalize());
            this._gizmo.setLength(nextTailRelativeLength, this.radius, this.radius);
            this._gizmo.position.copy(this._centerSpacePosition);
        }
    }

    class VRMSpringBoneImporterDebug extends VRMSpringBoneImporter {
        import(gltf) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
                if (!vrmExt)
                    return null;
                const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
                if (!schemaSecondaryAnimation)
                    return null;
                // 衝突判定球体メッシュ。
                const colliderGroups = yield this._importColliderMeshGroups(gltf, schemaSecondaryAnimation);
                // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
                // 一列だけではないことに注意。
                const springBoneGroupList = yield this._importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups);
                return new VRMSpringBoneManagerDebug(colliderGroups, springBoneGroupList);
            });
        }
        _createSpringBone(bone, params) {
            return new VRMSpringBoneDebug(bone, params);
        }
    }

    /**
     * An importer that imports a [[VRMDebug]] from a VRM extension of a GLTF.
     */
    class VRMImporterDebug extends VRMImporter {
        constructor(options = {}) {
            options.lookAtImporter = options.lookAtImporter || new VRMLookAtImporterDebug();
            options.springBoneImporter = options.springBoneImporter || new VRMSpringBoneImporterDebug();
            super(options);
        }
        import(gltf, debugOptions = {}) {
            return __awaiter(this, void 0, void 0, function* () {
                if (gltf.parser.json.extensions === undefined || gltf.parser.json.extensions.VRM === undefined) {
                    throw new Error('Could not find VRM extension on the GLTF');
                }
                const scene = gltf.scene;
                scene.updateMatrixWorld(false);
                // Skinned object should not be frustumCulled
                // Since pre-skinned position might be outside of view
                scene.traverse((object3d) => {
                    if (object3d.isMesh) {
                        object3d.frustumCulled = false;
                    }
                });
                const meta = (yield this._metaImporter.import(gltf)) || undefined;
                const materials = (yield this._materialImporter.convertGLTFMaterials(gltf)) || undefined;
                const humanoid = (yield this._humanoidImporter.import(gltf)) || undefined;
                const firstPerson = humanoid ? (yield this._firstPersonImporter.import(gltf, humanoid)) || undefined : undefined;
                const blendShapeProxy = (yield this._blendShapeImporter.import(gltf)) || undefined;
                const lookAt = firstPerson && blendShapeProxy && humanoid
                    ? (yield this._lookAtImporter.import(gltf, firstPerson, blendShapeProxy, humanoid)) || undefined
                    : undefined;
                if (lookAt.setupHelper) {
                    lookAt.setupHelper(scene, debugOptions);
                }
                const springBoneManager = (yield this._springBoneImporter.import(gltf)) || undefined;
                if (springBoneManager.setupHelper) {
                    springBoneManager.setupHelper(scene, debugOptions);
                }
                return new VRMDebug({
                    scene: gltf.scene,
                    meta,
                    materials,
                    humanoid,
                    firstPerson,
                    blendShapeProxy,
                    lookAt,
                    springBoneManager,
                }, debugOptions);
            });
        }
    }

    const VRM_GIZMO_RENDER_ORDER = 10000;
    /**
     * [[VRM]] but it has some useful gizmos.
     */
    class VRMDebug extends VRM {
        /**
         * Create a new VRMDebug from a parsed result of GLTF taken from GLTFLoader.
         *
         * See [[VRM.from]] for a detailed example.
         *
         * @param gltf A parsed GLTF object taken from GLTFLoader
         * @param options Options that will be used in importer
         * @param debugOption Options for VRMDebug features
         */
        static from(gltf, options = {}, debugOption = {}) {
            return __awaiter(this, void 0, void 0, function* () {
                const importer = new VRMImporterDebug(options);
                return yield importer.import(gltf, debugOption);
            });
        }
        /**
         * Create a new VRMDebug instance.
         *
         * @param params [[VRMParameters]] that represents components of the VRM
         * @param debugOption Options for VRMDebug features
         */
        constructor(params, debugOption = {}) {
            super(params);
            // Gizmoを展開
            if (!debugOption.disableBoxHelper) {
                this.scene.add(new THREE__namespace.BoxHelper(this.scene));
            }
            if (!debugOption.disableSkeletonHelper) {
                this.scene.add(new THREE__namespace.SkeletonHelper(this.scene));
            }
        }
        update(delta) {
            super.update(delta);
        }
    }

    exports.MToonMaterial = MToonMaterial;
    exports.VRM = VRM;
    exports.VRMBlendShapeGroup = VRMBlendShapeGroup;
    exports.VRMBlendShapeImporter = VRMBlendShapeImporter;
    exports.VRMBlendShapeProxy = VRMBlendShapeProxy;
    exports.VRMCurveMapper = VRMCurveMapper;
    exports.VRMDebug = VRMDebug;
    exports.VRMFirstPerson = VRMFirstPerson;
    exports.VRMFirstPersonImporter = VRMFirstPersonImporter;
    exports.VRMHumanBone = VRMHumanBone;
    exports.VRMHumanoid = VRMHumanoid;
    exports.VRMHumanoidImporter = VRMHumanoidImporter;
    exports.VRMImporter = VRMImporter;
    exports.VRMLookAtApplyer = VRMLookAtApplyer;
    exports.VRMLookAtBlendShapeApplyer = VRMLookAtBlendShapeApplyer;
    exports.VRMLookAtBoneApplyer = VRMLookAtBoneApplyer;
    exports.VRMLookAtHead = VRMLookAtHead;
    exports.VRMLookAtImporter = VRMLookAtImporter;
    exports.VRMMaterialImporter = VRMMaterialImporter;
    exports.VRMMetaImporter = VRMMetaImporter;
    exports.VRMRendererFirstPersonFlags = VRMRendererFirstPersonFlags;
    exports.VRMSpringBone = VRMSpringBone;
    exports.VRMSpringBoneDebug = VRMSpringBoneDebug;
    exports.VRMSpringBoneImporter = VRMSpringBoneImporter;
    exports.VRMSpringBoneImporterDebug = VRMSpringBoneImporterDebug;
    exports.VRMSpringBoneManager = VRMSpringBoneManager;
    exports.VRMUnlitMaterial = VRMUnlitMaterial;
    exports.VRMUtils = VRMUtils;
    exports.VRM_GIZMO_RENDER_ORDER = VRM_GIZMO_RENDER_ORDER;

    Object.defineProperty(exports, '__esModule', { value: true });

    Object.assign(THREE, exports);

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvdHNsaWIvdHNsaWIuZXM2LmpzIiwiLi4vc3JjL3V0aWxzL2Rpc3Bvc2VyLnRzIiwiLi4vc3JjL2JsZW5kc2hhcGUvVlJNQmxlbmRTaGFwZUdyb3VwLnRzIiwiLi4vc3JjL3R5cGVzL1ZSTVNjaGVtYS50cyIsIi4uL3NyYy91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZS50cyIsIi4uL3NyYy91dGlscy9yZW5hbWVNYXRlcmlhbFByb3BlcnR5LnRzIiwiLi4vc3JjL3V0aWxzL21hdGgudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlUHJveHkudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlSW1wb3J0ZXIudHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb24udHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb25JbXBvcnRlci50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmUudHMiLCIuLi9zcmMvdXRpbHMvcXVhdEludmVydENvbXBhdC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZEltcG9ydGVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1DdXJ2ZU1hcHBlci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QXBwbHllci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEhlYWQudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEJvbmVBcHBseWVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlci50cyIsIi4uL3NyYy9tYXRlcmlhbC9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24udHMiLCIuLi9zcmMvbWF0ZXJpYWwvTVRvb25NYXRlcmlhbC50cyIsIi4uL3NyYy9tYXRlcmlhbC9WUk1VbmxpdE1hdGVyaWFsLnRzIiwiLi4vc3JjL21hdGVyaWFsL1ZSTU1hdGVyaWFsSW1wb3J0ZXIudHMiLCIuLi9zcmMvbWV0YS9WUk1NZXRhSW1wb3J0ZXIudHMiLCIuLi9zcmMvdXRpbHMvbWF0NEludmVydENvbXBhdC50cyIsIi4uL3NyYy91dGlscy9NYXRyaXg0SW52ZXJzZUNhY2hlLnRzIiwiLi4vc3JjL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZS50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnRzIiwiLi4vc3JjL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZUltcG9ydGVyLnRzIiwiLi4vc3JjL1ZSTUltcG9ydGVyLnRzIiwiLi4vc3JjL1ZSTS50cyIsIi4uL3NyYy9WUk1VdGlscy9leHRyYWN0VGh1bWJuYWlsQmxvYi50cyIsIi4uL3NyYy9WUk1VdGlscy9yZW1vdmVVbm5lY2Vzc2FyeUpvaW50cy50cyIsIi4uL3NyYy9WUk1VdGlscy9pbmRleC50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1Mb29rQXRIZWFkRGVidWcudHMiLCIuLi9zcmMvZGVidWcvVlJNTG9va0F0SW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTVNwcmluZ0JvbmVEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1JbXBvcnRlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTURlYnVnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBmcm9tLmxlbmd0aCwgaiA9IHRvLmxlbmd0aDsgaSA8IGlsOyBpKyssIGorKylcclxuICAgICAgICB0b1tqXSA9IGZyb21baV07XHJcbiAgICByZXR1cm4gdG87XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHByaXZhdGVNYXApIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBnZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcHJpdmF0ZU1hcC5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgcHJpdmF0ZU1hcCwgdmFsdWUpIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBzZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICBwcml2YXRlTWFwLnNldChyZWNlaXZlciwgdmFsdWUpO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59XHJcbiIsIi8vIFNlZTogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNtYW51YWwvZW4vaW50cm9kdWN0aW9uL0hvdy10by1kaXNwb3NlLW9mLW9iamVjdHNcclxuXHJcbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuXHJcbmZ1bmN0aW9uIGRpc3Bvc2VNYXRlcmlhbChtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwpOiB2b2lkIHtcclxuICBPYmplY3Qua2V5cyhtYXRlcmlhbCkuZm9yRWFjaCgocHJvcGVydHlOYW1lKSA9PiB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV07XHJcbiAgICBpZiAodmFsdWU/LmlzVGV4dHVyZSkge1xyXG4gICAgICBjb25zdCB0ZXh0dXJlID0gdmFsdWUgYXMgVEhSRUUuVGV4dHVyZTtcclxuICAgICAgdGV4dHVyZS5kaXNwb3NlKCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIG1hdGVyaWFsLmRpc3Bvc2UoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGlzcG9zZShvYmplY3QzRDogVEhSRUUuT2JqZWN0M0QpOiB2b2lkIHtcclxuICBjb25zdCBnZW9tZXRyeTogVEhSRUUuQnVmZmVyR2VvbWV0cnkgfCB1bmRlZmluZWQgPSAob2JqZWN0M0QgYXMgYW55KS5nZW9tZXRyeTtcclxuICBpZiAoZ2VvbWV0cnkpIHtcclxuICAgIGdlb21ldHJ5LmRpc3Bvc2UoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCB8IFRIUkVFLk1hdGVyaWFsW10gPSAob2JqZWN0M0QgYXMgYW55KS5tYXRlcmlhbDtcclxuICBpZiAobWF0ZXJpYWwpIHtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGVyaWFsKSkge1xyXG4gICAgICBtYXRlcmlhbC5mb3JFYWNoKChtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwpID0+IGRpc3Bvc2VNYXRlcmlhbChtYXRlcmlhbCkpO1xyXG4gICAgfSBlbHNlIGlmIChtYXRlcmlhbCkge1xyXG4gICAgICBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWwpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGRlZXBEaXNwb3NlKG9iamVjdDNEOiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xyXG4gIG9iamVjdDNELnRyYXZlcnNlKGRpc3Bvc2UpO1xyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgR0xURlByaW1pdGl2ZSB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgVlJNQmxlbmRTaGFwZUJpbmQge1xyXG4gIG1lc2hlczogR0xURlByaW1pdGl2ZVtdO1xyXG4gIG1vcnBoVGFyZ2V0SW5kZXg6IG51bWJlcjtcclxuICB3ZWlnaHQ6IG51bWJlcjtcclxufVxyXG5cclxuZW51bSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUge1xyXG4gIE5VTUJFUixcclxuICBWRUNUT1IyLFxyXG4gIFZFQ1RPUjMsXHJcbiAgVkVDVE9SNCxcclxuICBDT0xPUixcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZSB7XHJcbiAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xyXG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xyXG4gIGRlZmF1bHRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XHJcbiAgdGFyZ2V0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xyXG4gIGRlbHRhVmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yOyAvLyB0YXJnZXRWYWx1ZSAtIGRlZmF1bHRWYWx1ZVxyXG4gIHR5cGU6IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZTtcclxufVxyXG5cclxuY29uc3QgX3YyID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcclxuY29uc3QgX3YzID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3Y0ID0gbmV3IFRIUkVFLlZlY3RvcjQoKTtcclxuY29uc3QgX2NvbG9yID0gbmV3IFRIUkVFLkNvbG9yKCk7XHJcblxyXG4vLyBhbmltYXRpb25NaXhlciDjga7nm6Poppblr77osaHjga/jgIFTY2VuZSDjga7kuK3jgavlhaXjgaPjgabjgYTjgovlv4XopoHjgYzjgYLjgovjgIJcclxuLy8g44Gd44Gu44Gf44KB44CB6KGo56S644Kq44OW44K444Kn44Kv44OI44Gn44Gv44Gq44GE44GR44KM44Gp44CBT2JqZWN0M0Qg44KS57aZ5om/44GX44GmIFNjZW5lIOOBq+aKleWFpeOBp+OBjeOCi+OCiOOBhuOBq+OBmeOCi+OAglxyXG5leHBvcnQgY2xhc3MgVlJNQmxlbmRTaGFwZUdyb3VwIGV4dGVuZHMgVEhSRUUuT2JqZWN0M0Qge1xyXG4gIHB1YmxpYyB3ZWlnaHQgPSAwLjA7XHJcbiAgcHVibGljIGlzQmluYXJ5ID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgX2JpbmRzOiBWUk1CbGVuZFNoYXBlQmluZFtdID0gW107XHJcbiAgcHJpdmF0ZSBfbWF0ZXJpYWxWYWx1ZXM6IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlW10gPSBbXTtcclxuXHJcbiAgY29uc3RydWN0b3IoZXhwcmVzc2lvbk5hbWU6IHN0cmluZykge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMubmFtZSA9IGBCbGVuZFNoYXBlQ29udHJvbGxlcl8ke2V4cHJlc3Npb25OYW1lfWA7XHJcblxyXG4gICAgLy8gdHJhdmVyc2Ug5pmC44Gu5pWR5riI5omL5q6144Go44GX44GmIE9iamVjdDNEIOOBp+OBr+OBquOBhOOBk+OBqOOCkuaYjuekuuOBl+OBpuOBiuOBj1xyXG4gICAgdGhpcy50eXBlID0gJ0JsZW5kU2hhcGVDb250cm9sbGVyJztcclxuICAgIC8vIOihqOekuuebrueahOOBruOCquODluOCuOOCp+OCr+ODiOOBp+OBr+OBquOBhOOBruOBp+OAgeiyoOiNt+i7vea4m+OBruOBn+OCgeOBqyB2aXNpYmxlIOOCkiBmYWxzZSDjgavjgZfjgabjgYrjgY/jgIJcclxuICAgIC8vIOOBk+OCjOOBq+OCiOOCiuOAgeOBk+OBruOCpOODs+OCueOCv+ODs+OCueOBq+WvvuOBmeOCi+avjuODleODrOODvOODoOOBriBtYXRyaXgg6Ieq5YuV6KiI566X44KS55yB55Wl44Gn44GN44KL44CCXHJcbiAgICB0aGlzLnZpc2libGUgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhZGRCaW5kKGFyZ3M6IHsgbWVzaGVzOiBHTFRGUHJpbWl0aXZlW107IG1vcnBoVGFyZ2V0SW5kZXg6IG51bWJlcjsgd2VpZ2h0OiBudW1iZXIgfSk6IHZvaWQge1xyXG4gICAgLy8gb3JpZ2luYWwgd2VpZ2h0IGlzIDAtMTAwIGJ1dCB3ZSB3YW50IHRvIGRlYWwgd2l0aCB0aGlzIHZhbHVlIHdpdGhpbiAwLTFcclxuICAgIGNvbnN0IHdlaWdodCA9IGFyZ3Mud2VpZ2h0IC8gMTAwO1xyXG5cclxuICAgIHRoaXMuX2JpbmRzLnB1c2goe1xyXG4gICAgICBtZXNoZXM6IGFyZ3MubWVzaGVzLFxyXG4gICAgICBtb3JwaFRhcmdldEluZGV4OiBhcmdzLm1vcnBoVGFyZ2V0SW5kZXgsXHJcbiAgICAgIHdlaWdodCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFkZE1hdGVyaWFsVmFsdWUoYXJnczoge1xyXG4gICAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xyXG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XHJcbiAgICB0YXJnZXRWYWx1ZTogbnVtYmVyW107XHJcbiAgICBkZWZhdWx0VmFsdWU/OiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcclxuICB9KTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXRlcmlhbCA9IGFyZ3MubWF0ZXJpYWw7XHJcbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBhcmdzLnByb3BlcnR5TmFtZTtcclxuXHJcbiAgICBsZXQgdmFsdWUgPSAobWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eU5hbWVdO1xyXG4gICAgaWYgKCF2YWx1ZSkge1xyXG4gICAgICAvLyBwcm9wZXJ0eSBoYXMgbm90IGJlZW4gZm91bmRcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdmFsdWUgPSBhcmdzLmRlZmF1bHRWYWx1ZSB8fCB2YWx1ZTtcclxuXHJcbiAgICBsZXQgdHlwZTogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlO1xyXG4gICAgbGV0IGRlZmF1bHRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XHJcbiAgICBsZXQgdGFyZ2V0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xyXG4gICAgbGV0IGRlbHRhVmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xyXG5cclxuICAgIGlmICh2YWx1ZS5pc1ZlY3RvcjIpIHtcclxuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyO1xyXG4gICAgICBkZWZhdWx0VmFsdWUgPSAodmFsdWUgYXMgVEhSRUUuVmVjdG9yMikuY2xvbmUoKTtcclxuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yMigpLmZyb21BcnJheShhcmdzLnRhcmdldFZhbHVlKTtcclxuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XHJcbiAgICB9IGVsc2UgaWYgKHZhbHVlLmlzVmVjdG9yMykge1xyXG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjM7XHJcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5WZWN0b3IzKS5jbG9uZSgpO1xyXG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IzKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xyXG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcclxuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNWZWN0b3I0KSB7XHJcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SNDtcclxuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLlZlY3RvcjQpLmNsb25lKCk7XHJcblxyXG4gICAgICAvLyB2ZWN0b3JQcm9wZXJ0eSBhbmQgdGFyZ2V0VmFsdWUgaW5kZXggaXMgZGlmZmVyZW50IGZyb20gZWFjaCBvdGhlclxyXG4gICAgICAvLyBleHBvcnRlZCB2cm0gYnkgVW5pVlJNIGZpbGUgaXNcclxuICAgICAgLy9cclxuICAgICAgLy8gdmVjdG9yUHJvcGVydHlcclxuICAgICAgLy8gb2Zmc2V0ID0gdGFyZ2V0VmFsdWVbMF0sIHRhcmdldFZhbHVlWzFdXHJcbiAgICAgIC8vIHRpbGluZyA9IHRhcmdldFZhbHVlWzJdLCB0YXJnZXRWYWx1ZVszXVxyXG4gICAgICAvL1xyXG4gICAgICAvLyB0YXJnZXRWYWx1ZVxyXG4gICAgICAvLyBvZmZzZXQgPSB0YXJnZXRWYWx1ZVsyXSwgdGFyZ2V0VmFsdWVbM11cclxuICAgICAgLy8gdGlsaW5nID0gdGFyZ2V0VmFsdWVbMF0sIHRhcmdldFZhbHVlWzFdXHJcbiAgICAgIHRhcmdldFZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjQoKS5mcm9tQXJyYXkoW1xyXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMl0sXHJcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVszXSxcclxuICAgICAgICBhcmdzLnRhcmdldFZhbHVlWzBdLFxyXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMV0sXHJcbiAgICAgIF0pO1xyXG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcclxuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNDb2xvcikge1xyXG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLkNPTE9SO1xyXG4gICAgICBkZWZhdWx0VmFsdWUgPSAodmFsdWUgYXMgVEhSRUUuQ29sb3IpLmNsb25lKCk7XHJcbiAgICAgIHRhcmdldFZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xyXG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuTlVNQkVSO1xyXG4gICAgICBkZWZhdWx0VmFsdWUgPSB2YWx1ZSBhcyBudW1iZXI7XHJcbiAgICAgIHRhcmdldFZhbHVlID0gYXJncy50YXJnZXRWYWx1ZVswXTtcclxuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlIC0gZGVmYXVsdFZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX21hdGVyaWFsVmFsdWVzLnB1c2goe1xyXG4gICAgICBtYXRlcmlhbCxcclxuICAgICAgcHJvcGVydHlOYW1lLFxyXG4gICAgICBkZWZhdWx0VmFsdWUsXHJcbiAgICAgIHRhcmdldFZhbHVlLFxyXG4gICAgICBkZWx0YVZhbHVlLFxyXG4gICAgICB0eXBlLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBcHBseSB3ZWlnaHQgdG8gZXZlcnkgYXNzaWduZWQgYmxlbmQgc2hhcGVzLlxyXG4gICAqIFNob3VsZCBiZSBjYWxsZWQgdmlhIHtAbGluayBCbGVuZFNoYXBlTWFzdGVyI3VwZGF0ZX0uXHJcbiAgICovXHJcbiAgcHVibGljIGFwcGx5V2VpZ2h0KCk6IHZvaWQge1xyXG4gICAgY29uc3QgdyA9IHRoaXMuaXNCaW5hcnkgPyAodGhpcy53ZWlnaHQgPCAwLjUgPyAwLjAgOiAxLjApIDogdGhpcy53ZWlnaHQ7XHJcblxyXG4gICAgdGhpcy5fYmluZHMuZm9yRWFjaCgoYmluZCkgPT4ge1xyXG4gICAgICBiaW5kLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XHJcbiAgICAgICAgaWYgKCFtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcykge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkQmluZGBcclxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1tiaW5kLm1vcnBoVGFyZ2V0SW5kZXhdICs9IHcgKiBiaW5kLndlaWdodDtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLl9tYXRlcmlhbFZhbHVlcy5mb3JFYWNoKChtYXRlcmlhbFZhbHVlKSA9PiB7XHJcbiAgICAgIGNvbnN0IHByb3AgPSAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXTtcclxuICAgICAgaWYgKHByb3AgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRNYXRlcmlhbFZhbHVlYFxyXG5cclxuICAgICAgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLk5VTUJFUikge1xyXG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgbnVtYmVyO1xyXG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdICs9IGRlbHRhVmFsdWUgKiB3O1xyXG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjIpIHtcclxuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLlZlY3RvcjI7XHJcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF92Mi5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcclxuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IzKSB7XHJcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5WZWN0b3IzO1xyXG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmFkZChfdjMuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3KSk7XHJcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SNCkge1xyXG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgVEhSRUUuVmVjdG9yNDtcclxuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX3Y0LmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xyXG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLkNPTE9SKSB7XHJcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5Db2xvcjtcclxuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX2NvbG9yLmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodHlwZW9mIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KS5zaG91bGRBcHBseVVuaWZvcm1zID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbGVhciBwcmV2aW91c2x5IGFzc2lnbmVkIGJsZW5kIHNoYXBlcy5cclxuICAgKi9cclxuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5fYmluZHMuZm9yRWFjaCgoYmluZCkgPT4ge1xyXG4gICAgICBiaW5kLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XHJcbiAgICAgICAgaWYgKCFtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcykge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkQmluZGBcclxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1tiaW5kLm1vcnBoVGFyZ2V0SW5kZXhdID0gMC4wO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuX21hdGVyaWFsVmFsdWVzLmZvckVhY2goKG1hdGVyaWFsVmFsdWUpID0+IHtcclxuICAgICAgY29uc3QgcHJvcCA9IChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdO1xyXG4gICAgICBpZiAocHJvcCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXHJcblxyXG4gICAgICBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuTlVNQkVSKSB7XHJcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgbnVtYmVyO1xyXG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdID0gZGVmYXVsdFZhbHVlO1xyXG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjIpIHtcclxuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5WZWN0b3IyO1xyXG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcclxuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IzKSB7XHJcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuVmVjdG9yMztcclxuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5jb3B5KGRlZmF1bHRWYWx1ZSk7XHJcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SNCkge1xyXG4gICAgICAgIGNvbnN0IGRlZmF1bHRWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVmYXVsdFZhbHVlIGFzIFRIUkVFLlZlY3RvcjQ7XHJcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xyXG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLkNPTE9SKSB7XHJcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuQ29sb3I7XHJcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodHlwZW9mIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KS5zaG91bGRBcHBseVVuaWZvcm1zID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiIsIi8vIFR5cGVkb2MgZG9lcyBub3Qgc3VwcG9ydCBleHBvcnQgZGVjbGFyYXRpb25zIHlldFxyXG4vLyB0aGVuIHdlIGhhdmUgdG8gdXNlIGBuYW1lc3BhY2VgIGluc3RlYWQgb2YgZXhwb3J0IGRlY2xhcmF0aW9ucyBmb3Igbm93LlxyXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9UeXBlU3Ryb25nL3R5cGVkb2MvcHVsbC84MDFcclxuXHJcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbmFtZXNwYWNlXHJcbmV4cG9ydCBuYW1lc3BhY2UgVlJNU2NoZW1hIHtcclxuICAvKipcclxuICAgKiBWUk0gZXh0ZW5zaW9uIGlzIGZvciAzZCBodW1hbm9pZCBhdmF0YXJzIChhbmQgbW9kZWxzKSBpbiBWUiBhcHBsaWNhdGlvbnMuXHJcbiAgICovXHJcbiAgZXhwb3J0IGludGVyZmFjZSBWUk0ge1xyXG4gICAgYmxlbmRTaGFwZU1hc3Rlcj86IEJsZW5kU2hhcGU7XHJcbiAgICAvKipcclxuICAgICAqIFZlcnNpb24gb2YgZXhwb3J0ZXIgdGhhdCB2cm0gY3JlYXRlZC4gVW5pVlJNLTAuNTMuMFxyXG4gICAgICovXHJcbiAgICBleHBvcnRlclZlcnNpb24/OiBzdHJpbmc7XHJcbiAgICBmaXJzdFBlcnNvbj86IEZpcnN0UGVyc29uO1xyXG4gICAgaHVtYW5vaWQ/OiBIdW1hbm9pZDtcclxuICAgIG1hdGVyaWFsUHJvcGVydGllcz86IE1hdGVyaWFsW107XHJcbiAgICBtZXRhPzogTWV0YTtcclxuICAgIHNlY29uZGFyeUFuaW1hdGlvbj86IFNlY29uZGFyeUFuaW1hdGlvbjtcclxuICAgIC8qKlxyXG4gICAgICogVmVyc2lvbiBvZiBWUk0gc3BlY2lmaWNhdGlvbi4gMC4wXHJcbiAgICAgKi9cclxuICAgIHNwZWNWZXJzaW9uPzogc3RyaW5nO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQmxlbmRTaGFwZUF2YXRhciBvZiBVbmlWUk1cclxuICAgKi9cclxuICBleHBvcnQgaW50ZXJmYWNlIEJsZW5kU2hhcGUge1xyXG4gICAgYmxlbmRTaGFwZUdyb3Vwcz86IEJsZW5kU2hhcGVHcm91cFtdO1xyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGludGVyZmFjZSBCbGVuZFNoYXBlR3JvdXAge1xyXG4gICAgLyoqXHJcbiAgICAgKiBMb3cgbGV2ZWwgYmxlbmRzaGFwZSByZWZlcmVuY2VzLlxyXG4gICAgICovXHJcbiAgICBiaW5kcz86IEJsZW5kU2hhcGVCaW5kW107XHJcbiAgICAvKipcclxuICAgICAqIDAgb3IgMS4gRG8gbm90IGFsbG93IGFuIGludGVybWVkaWF0ZSB2YWx1ZS4gVmFsdWUgc2hvdWxkIHJvdW5kZWRcclxuICAgICAqL1xyXG4gICAgaXNCaW5hcnk/OiBib29sZWFuO1xyXG4gICAgLyoqXHJcbiAgICAgKiBNYXRlcmlhbCBhbmltYXRpb24gcmVmZXJlbmNlcy5cclxuICAgICAqL1xyXG4gICAgbWF0ZXJpYWxWYWx1ZXM/OiBCbGVuZFNoYXBlTWF0ZXJpYWxiaW5kW107XHJcbiAgICAvKipcclxuICAgICAqIEV4cHJlc3Npb24gbmFtZVxyXG4gICAgICovXHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgLyoqXHJcbiAgICAgKiBQcmVkZWZpbmVkIEV4cHJlc3Npb24gbmFtZVxyXG4gICAgICovXHJcbiAgICBwcmVzZXROYW1lPzogQmxlbmRTaGFwZVByZXNldE5hbWU7XHJcbiAgfVxyXG5cclxuICBleHBvcnQgaW50ZXJmYWNlIEJsZW5kU2hhcGVCaW5kIHtcclxuICAgIGluZGV4PzogbnVtYmVyO1xyXG4gICAgbWVzaD86IG51bWJlcjtcclxuICAgIC8qKlxyXG4gICAgICogU2tpbm5lZE1lc2hSZW5kZXJlci5TZXRCbGVuZFNoYXBlV2VpZ2h0XHJcbiAgICAgKi9cclxuICAgIHdlaWdodD86IG51bWJlcjtcclxuICB9XHJcblxyXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZU1hdGVyaWFsYmluZCB7XHJcbiAgICBtYXRlcmlhbE5hbWU/OiBzdHJpbmc7XHJcbiAgICBwcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICB0YXJnZXRWYWx1ZT86IG51bWJlcltdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUHJlZGVmaW5lZCBFeHByZXNzaW9uIG5hbWVcclxuICAgKi9cclxuICBleHBvcnQgZW51bSBCbGVuZFNoYXBlUHJlc2V0TmFtZSB7XHJcbiAgICBBID0gJ2EnLFxyXG4gICAgQW5ncnkgPSAnYW5ncnknLFxyXG4gICAgQmxpbmsgPSAnYmxpbmsnLFxyXG4gICAgQmxpbmtMID0gJ2JsaW5rX2wnLFxyXG4gICAgQmxpbmtSID0gJ2JsaW5rX3InLFxyXG4gICAgRSA9ICdlJyxcclxuICAgIEZ1biA9ICdmdW4nLFxyXG4gICAgSSA9ICdpJyxcclxuICAgIEpveSA9ICdqb3knLFxyXG4gICAgTG9va2Rvd24gPSAnbG9va2Rvd24nLFxyXG4gICAgTG9va2xlZnQgPSAnbG9va2xlZnQnLFxyXG4gICAgTG9va3JpZ2h0ID0gJ2xvb2tyaWdodCcsXHJcbiAgICBMb29rdXAgPSAnbG9va3VwJyxcclxuICAgIE5ldXRyYWwgPSAnbmV1dHJhbCcsXHJcbiAgICBPID0gJ28nLFxyXG4gICAgU29ycm93ID0gJ3NvcnJvdycsXHJcbiAgICBVID0gJ3UnLFxyXG4gICAgVW5rbm93biA9ICd1bmtub3duJyxcclxuICB9XHJcblxyXG4gIGV4cG9ydCBpbnRlcmZhY2UgRmlyc3RQZXJzb24ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgYm9uZSB3aG9zZSByZW5kZXJpbmcgc2hvdWxkIGJlIHR1cm5lZCBvZmYgaW4gZmlyc3QtcGVyc29uIHZpZXcuIFVzdWFsbHkgSGVhZCBpc1xyXG4gICAgICogc3BlY2lmaWVkLlxyXG4gICAgICovXHJcbiAgICBmaXJzdFBlcnNvbkJvbmU/OiBudW1iZXI7XHJcbiAgICAvKipcclxuICAgICAqIFRoZSB0YXJnZXQgcG9zaXRpb24gb2YgdGhlIFZSIGhlYWRzZXQgaW4gZmlyc3QtcGVyc29uIHZpZXcuIEl0IGlzIGFzc3VtZWQgdGhhdCBhbiBvZmZzZXRcclxuICAgICAqIGZyb20gdGhlIGhlYWQgYm9uZSB0byB0aGUgVlIgaGVhZHNldCBpcyBhZGRlZC5cclxuICAgICAqL1xyXG4gICAgZmlyc3RQZXJzb25Cb25lT2Zmc2V0PzogVmVjdG9yMztcclxuICAgIGxvb2tBdEhvcml6b250YWxJbm5lcj86IEZpcnN0UGVyc29uRGVncmVlTWFwO1xyXG4gICAgbG9va0F0SG9yaXpvbnRhbE91dGVyPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XHJcbiAgICAvKipcclxuICAgICAqIEV5ZSBjb250cm9sbGVyIG1vZGUuXHJcbiAgICAgKi9cclxuICAgIGxvb2tBdFR5cGVOYW1lPzogRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZTtcclxuICAgIGxvb2tBdFZlcnRpY2FsRG93bj86IEZpcnN0UGVyc29uRGVncmVlTWFwO1xyXG4gICAgbG9va0F0VmVydGljYWxVcD86IEZpcnN0UGVyc29uRGVncmVlTWFwO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTd2l0Y2ggZGlzcGxheSAvIHVuZGlzcGxheSBmb3IgZWFjaCBtZXNoIGluIGZpcnN0LXBlcnNvbiB2aWV3IG9yIHRoZSBvdGhlcnMuXHJcbiAgICAgKi9cclxuICAgIG1lc2hBbm5vdGF0aW9ucz86IEZpcnN0UGVyc29uTWVzaGFubm90YXRpb25bXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEV5ZSBjb250cm9sbGVyIHNldHRpbmcuXHJcbiAgICovXHJcbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbkRlZ3JlZU1hcCB7XHJcbiAgICAvKipcclxuICAgICAqIE5vbmUgbGluZWFyIG1hcHBpbmcgcGFyYW1zLiB0aW1lLCB2YWx1ZSwgaW5UYW5nZW50LCBvdXRUYW5nZW50XHJcbiAgICAgKi9cclxuICAgIGN1cnZlPzogbnVtYmVyW107XHJcbiAgICAvKipcclxuICAgICAqIExvb2sgYXQgaW5wdXQgY2xhbXAgcmFuZ2UgZGVncmVlLlxyXG4gICAgICovXHJcbiAgICB4UmFuZ2U/OiBudW1iZXI7XHJcbiAgICAvKipcclxuICAgICAqIExvb2sgYXQgbWFwIHJhbmdlIGRlZ3JlZSBmcm9tIHhSYW5nZS5cclxuICAgICAqL1xyXG4gICAgeVJhbmdlPzogbnVtYmVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRXllIGNvbnRyb2xsZXIgbW9kZS5cclxuICAgKi9cclxuICBleHBvcnQgZW51bSBGaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lIHtcclxuICAgIEJsZW5kU2hhcGUgPSAnQmxlbmRTaGFwZScsXHJcbiAgICBCb25lID0gJ0JvbmUnLFxyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbk1lc2hhbm5vdGF0aW9uIHtcclxuICAgIGZpcnN0UGVyc29uRmxhZz86IHN0cmluZztcclxuICAgIG1lc2g/OiBudW1iZXI7XHJcbiAgfVxyXG5cclxuICBleHBvcnQgaW50ZXJmYWNlIEh1bWFub2lkIHtcclxuICAgIC8qKlxyXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmFybVN0cmV0Y2hcclxuICAgICAqL1xyXG4gICAgYXJtU3RyZXRjaD86IG51bWJlcjtcclxuICAgIC8qKlxyXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmZlZXRTcGFjaW5nXHJcbiAgICAgKi9cclxuICAgIGZlZXRTcGFjaW5nPzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24uaGFzVHJhbnNsYXRpb25Eb0ZcclxuICAgICAqL1xyXG4gICAgaGFzVHJhbnNsYXRpb25Eb0Y/OiBib29sZWFuO1xyXG4gICAgaHVtYW5Cb25lcz86IEh1bWFub2lkQm9uZVtdO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubGVnU3RyZXRjaFxyXG4gICAgICovXHJcbiAgICBsZWdTdHJldGNoPzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubG93ZXJBcm1Ud2lzdFxyXG4gICAgICovXHJcbiAgICBsb3dlckFybVR3aXN0PzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubG93ZXJMZWdUd2lzdFxyXG4gICAgICovXHJcbiAgICBsb3dlckxlZ1R3aXN0PzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24udXBwZXJBcm1Ud2lzdFxyXG4gICAgICovXHJcbiAgICB1cHBlckFybVR3aXN0PzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24udXBwZXJMZWdUd2lzdFxyXG4gICAgICovXHJcbiAgICB1cHBlckxlZ1R3aXN0PzogbnVtYmVyO1xyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGludGVyZmFjZSBIdW1hbm9pZEJvbmUge1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQuYXhpc0xlbmd0aFxyXG4gICAgICovXHJcbiAgICBheGlzTGVuZ3RoPzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBIdW1hbiBib25lIG5hbWUuXHJcbiAgICAgKi9cclxuICAgIGJvbmU/OiBIdW1hbm9pZEJvbmVOYW1lO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQuY2VudGVyXHJcbiAgICAgKi9cclxuICAgIGNlbnRlcj86IFZlY3RvcjM7XHJcbiAgICAvKipcclxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5tYXhcclxuICAgICAqL1xyXG4gICAgbWF4PzogVmVjdG9yMztcclxuICAgIC8qKlxyXG4gICAgICogVW5pdHkncyBIdW1hbkxpbWl0Lm1pblxyXG4gICAgICovXHJcbiAgICBtaW4/OiBWZWN0b3IzO1xyXG4gICAgLyoqXHJcbiAgICAgKiBSZWZlcmVuY2Ugbm9kZSBpbmRleFxyXG4gICAgICovXHJcbiAgICBub2RlPzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQudXNlRGVmYXVsdFZhbHVlc1xyXG4gICAgICovXHJcbiAgICB1c2VEZWZhdWx0VmFsdWVzPzogYm9vbGVhbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEh1bWFuIGJvbmUgbmFtZS5cclxuICAgKi9cclxuICBleHBvcnQgZW51bSBIdW1hbm9pZEJvbmVOYW1lIHtcclxuICAgIENoZXN0ID0gJ2NoZXN0JyxcclxuICAgIEhlYWQgPSAnaGVhZCcsXHJcbiAgICBIaXBzID0gJ2hpcHMnLFxyXG4gICAgSmF3ID0gJ2phdycsXHJcbiAgICBMZWZ0RXllID0gJ2xlZnRFeWUnLFxyXG4gICAgTGVmdEZvb3QgPSAnbGVmdEZvb3QnLFxyXG4gICAgTGVmdEhhbmQgPSAnbGVmdEhhbmQnLFxyXG4gICAgTGVmdEluZGV4RGlzdGFsID0gJ2xlZnRJbmRleERpc3RhbCcsXHJcbiAgICBMZWZ0SW5kZXhJbnRlcm1lZGlhdGUgPSAnbGVmdEluZGV4SW50ZXJtZWRpYXRlJyxcclxuICAgIExlZnRJbmRleFByb3hpbWFsID0gJ2xlZnRJbmRleFByb3hpbWFsJyxcclxuICAgIExlZnRMaXR0bGVEaXN0YWwgPSAnbGVmdExpdHRsZURpc3RhbCcsXHJcbiAgICBMZWZ0TGl0dGxlSW50ZXJtZWRpYXRlID0gJ2xlZnRMaXR0bGVJbnRlcm1lZGlhdGUnLFxyXG4gICAgTGVmdExpdHRsZVByb3hpbWFsID0gJ2xlZnRMaXR0bGVQcm94aW1hbCcsXHJcbiAgICBMZWZ0TG93ZXJBcm0gPSAnbGVmdExvd2VyQXJtJyxcclxuICAgIExlZnRMb3dlckxlZyA9ICdsZWZ0TG93ZXJMZWcnLFxyXG4gICAgTGVmdE1pZGRsZURpc3RhbCA9ICdsZWZ0TWlkZGxlRGlzdGFsJyxcclxuICAgIExlZnRNaWRkbGVJbnRlcm1lZGlhdGUgPSAnbGVmdE1pZGRsZUludGVybWVkaWF0ZScsXHJcbiAgICBMZWZ0TWlkZGxlUHJveGltYWwgPSAnbGVmdE1pZGRsZVByb3hpbWFsJyxcclxuICAgIExlZnRSaW5nRGlzdGFsID0gJ2xlZnRSaW5nRGlzdGFsJyxcclxuICAgIExlZnRSaW5nSW50ZXJtZWRpYXRlID0gJ2xlZnRSaW5nSW50ZXJtZWRpYXRlJyxcclxuICAgIExlZnRSaW5nUHJveGltYWwgPSAnbGVmdFJpbmdQcm94aW1hbCcsXHJcbiAgICBMZWZ0U2hvdWxkZXIgPSAnbGVmdFNob3VsZGVyJyxcclxuICAgIExlZnRUaHVtYkRpc3RhbCA9ICdsZWZ0VGh1bWJEaXN0YWwnLFxyXG4gICAgTGVmdFRodW1iSW50ZXJtZWRpYXRlID0gJ2xlZnRUaHVtYkludGVybWVkaWF0ZScsXHJcbiAgICBMZWZ0VGh1bWJQcm94aW1hbCA9ICdsZWZ0VGh1bWJQcm94aW1hbCcsXHJcbiAgICBMZWZ0VG9lcyA9ICdsZWZ0VG9lcycsXHJcbiAgICBMZWZ0VXBwZXJBcm0gPSAnbGVmdFVwcGVyQXJtJyxcclxuICAgIExlZnRVcHBlckxlZyA9ICdsZWZ0VXBwZXJMZWcnLFxyXG4gICAgTmVjayA9ICduZWNrJyxcclxuICAgIFJpZ2h0RXllID0gJ3JpZ2h0RXllJyxcclxuICAgIFJpZ2h0Rm9vdCA9ICdyaWdodEZvb3QnLFxyXG4gICAgUmlnaHRIYW5kID0gJ3JpZ2h0SGFuZCcsXHJcbiAgICBSaWdodEluZGV4RGlzdGFsID0gJ3JpZ2h0SW5kZXhEaXN0YWwnLFxyXG4gICAgUmlnaHRJbmRleEludGVybWVkaWF0ZSA9ICdyaWdodEluZGV4SW50ZXJtZWRpYXRlJyxcclxuICAgIFJpZ2h0SW5kZXhQcm94aW1hbCA9ICdyaWdodEluZGV4UHJveGltYWwnLFxyXG4gICAgUmlnaHRMaXR0bGVEaXN0YWwgPSAncmlnaHRMaXR0bGVEaXN0YWwnLFxyXG4gICAgUmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUgPSAncmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUnLFxyXG4gICAgUmlnaHRMaXR0bGVQcm94aW1hbCA9ICdyaWdodExpdHRsZVByb3hpbWFsJyxcclxuICAgIFJpZ2h0TG93ZXJBcm0gPSAncmlnaHRMb3dlckFybScsXHJcbiAgICBSaWdodExvd2VyTGVnID0gJ3JpZ2h0TG93ZXJMZWcnLFxyXG4gICAgUmlnaHRNaWRkbGVEaXN0YWwgPSAncmlnaHRNaWRkbGVEaXN0YWwnLFxyXG4gICAgUmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUgPSAncmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUnLFxyXG4gICAgUmlnaHRNaWRkbGVQcm94aW1hbCA9ICdyaWdodE1pZGRsZVByb3hpbWFsJyxcclxuICAgIFJpZ2h0UmluZ0Rpc3RhbCA9ICdyaWdodFJpbmdEaXN0YWwnLFxyXG4gICAgUmlnaHRSaW5nSW50ZXJtZWRpYXRlID0gJ3JpZ2h0UmluZ0ludGVybWVkaWF0ZScsXHJcbiAgICBSaWdodFJpbmdQcm94aW1hbCA9ICdyaWdodFJpbmdQcm94aW1hbCcsXHJcbiAgICBSaWdodFNob3VsZGVyID0gJ3JpZ2h0U2hvdWxkZXInLFxyXG4gICAgUmlnaHRUaHVtYkRpc3RhbCA9ICdyaWdodFRodW1iRGlzdGFsJyxcclxuICAgIFJpZ2h0VGh1bWJJbnRlcm1lZGlhdGUgPSAncmlnaHRUaHVtYkludGVybWVkaWF0ZScsXHJcbiAgICBSaWdodFRodW1iUHJveGltYWwgPSAncmlnaHRUaHVtYlByb3hpbWFsJyxcclxuICAgIFJpZ2h0VG9lcyA9ICdyaWdodFRvZXMnLFxyXG4gICAgUmlnaHRVcHBlckFybSA9ICdyaWdodFVwcGVyQXJtJyxcclxuICAgIFJpZ2h0VXBwZXJMZWcgPSAncmlnaHRVcHBlckxlZycsXHJcbiAgICBTcGluZSA9ICdzcGluZScsXHJcbiAgICBVcHBlckNoZXN0ID0gJ3VwcGVyQ2hlc3QnLFxyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGludGVyZmFjZSBNYXRlcmlhbCB7XHJcbiAgICBmbG9hdFByb3BlcnRpZXM/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xyXG4gICAga2V5d29yZE1hcD86IHsgW2tleTogc3RyaW5nXTogYW55IH07XHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgcmVuZGVyUXVldWU/OiBudW1iZXI7XHJcbiAgICBzaGFkZXI/OiBzdHJpbmc7XHJcbiAgICB0YWdNYXA/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xyXG4gICAgdGV4dHVyZVByb3BlcnRpZXM/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xyXG4gICAgdmVjdG9yUHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XHJcbiAgfVxyXG5cclxuICBleHBvcnQgaW50ZXJmYWNlIE1ldGEge1xyXG4gICAgLyoqXHJcbiAgICAgKiBBIHBlcnNvbiB3aG8gY2FuIHBlcmZvcm0gd2l0aCB0aGlzIGF2YXRhclxyXG4gICAgICovXHJcbiAgICBhbGxvd2VkVXNlck5hbWU/OiBNZXRhQWxsb3dlZFVzZXJOYW1lO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdXRob3Igb2YgVlJNIG1vZGVsXHJcbiAgICAgKi9cclxuICAgIGF1dGhvcj86IHN0cmluZztcclxuICAgIC8qKlxyXG4gICAgICogRm9yIGNvbW1lcmNpYWwgdXNlXHJcbiAgICAgKi9cclxuICAgIGNvbW1lcmNpYWxVc3NhZ2VOYW1lPzogTWV0YVVzc2FnZU5hbWU7XHJcbiAgICAvKipcclxuICAgICAqIENvbnRhY3QgSW5mb3JtYXRpb24gb2YgVlJNIG1vZGVsIGF1dGhvclxyXG4gICAgICovXHJcbiAgICBjb250YWN0SW5mb3JtYXRpb24/OiBzdHJpbmc7XHJcbiAgICAvKipcclxuICAgICAqIExpY2Vuc2UgdHlwZVxyXG4gICAgICovXHJcbiAgICBsaWNlbnNlTmFtZT86IE1ldGFMaWNlbnNlTmFtZTtcclxuICAgIC8qKlxyXG4gICAgICogSWYg4oCcT3RoZXLigJ0gaXMgc2VsZWN0ZWQsIHB1dCB0aGUgVVJMIGxpbmsgb2YgdGhlIGxpY2Vuc2UgZG9jdW1lbnQgaGVyZS5cclxuICAgICAqL1xyXG4gICAgb3RoZXJMaWNlbnNlVXJsPzogc3RyaW5nO1xyXG4gICAgLyoqXHJcbiAgICAgKiBJZiB0aGVyZSBhcmUgYW55IGNvbmRpdGlvbnMgbm90IG1lbnRpb25lZCBhYm92ZSwgcHV0IHRoZSBVUkwgbGluayBvZiB0aGUgbGljZW5zZSBkb2N1bWVudFxyXG4gICAgICogaGVyZS5cclxuICAgICAqL1xyXG4gICAgb3RoZXJQZXJtaXNzaW9uVXJsPzogc3RyaW5nO1xyXG4gICAgLyoqXHJcbiAgICAgKiBSZWZlcmVuY2Ugb2YgVlJNIG1vZGVsXHJcbiAgICAgKi9cclxuICAgIHJlZmVyZW5jZT86IHN0cmluZztcclxuICAgIC8qKlxyXG4gICAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHNleHVhbCBhY3RzIHdpdGggdGhpcyBhdmF0YXJcclxuICAgICAqL1xyXG4gICAgc2V4dWFsVXNzYWdlTmFtZT86IE1ldGFVc3NhZ2VOYW1lO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaHVtYm5haWwgb2YgVlJNIG1vZGVsXHJcbiAgICAgKi9cclxuICAgIHRleHR1cmU/OiBudW1iZXI7XHJcbiAgICAvKipcclxuICAgICAqIFRpdGxlIG9mIFZSTSBtb2RlbFxyXG4gICAgICovXHJcbiAgICB0aXRsZT86IHN0cmluZztcclxuICAgIC8qKlxyXG4gICAgICogVmVyc2lvbiBvZiBWUk0gbW9kZWxcclxuICAgICAqL1xyXG4gICAgdmVyc2lvbj86IHN0cmluZztcclxuICAgIC8qKlxyXG4gICAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHZpb2xlbnQgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXHJcbiAgICAgKi9cclxuICAgIHZpb2xlbnRVc3NhZ2VOYW1lPzogTWV0YVVzc2FnZU5hbWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBIHBlcnNvbiB3aG8gY2FuIHBlcmZvcm0gd2l0aCB0aGlzIGF2YXRhclxyXG4gICAqL1xyXG4gIGV4cG9ydCBlbnVtIE1ldGFBbGxvd2VkVXNlck5hbWUge1xyXG4gICAgRXZlcnlvbmUgPSAnRXZlcnlvbmUnLFxyXG4gICAgRXhwbGljaXRseUxpY2Vuc2VkUGVyc29uID0gJ0V4cGxpY2l0bHlMaWNlbnNlZFBlcnNvbicsXHJcbiAgICBPbmx5QXV0aG9yID0gJ09ubHlBdXRob3InLFxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRm9yIGNvbW1lcmNpYWwgdXNlXHJcbiAgICpcclxuICAgKiBQZXJtaXNzaW9uIHRvIHBlcmZvcm0gc2V4dWFsIGFjdHMgd2l0aCB0aGlzIGF2YXRhclxyXG4gICAqXHJcbiAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHZpb2xlbnQgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXHJcbiAgICovXHJcbiAgZXhwb3J0IGVudW0gTWV0YVVzc2FnZU5hbWUge1xyXG4gICAgQWxsb3cgPSAnQWxsb3cnLFxyXG4gICAgRGlzYWxsb3cgPSAnRGlzYWxsb3cnLFxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTGljZW5zZSB0eXBlXHJcbiAgICovXHJcbiAgZXhwb3J0IGVudW0gTWV0YUxpY2Vuc2VOYW1lIHtcclxuICAgIENjMCA9ICdDQzAnLFxyXG4gICAgQ2NCeSA9ICdDQ19CWScsXHJcbiAgICBDY0J5TmMgPSAnQ0NfQllfTkMnLFxyXG4gICAgQ2NCeU5jTmQgPSAnQ0NfQllfTkNfTkQnLFxyXG4gICAgQ2NCeU5jU2EgPSAnQ0NfQllfTkNfU0EnLFxyXG4gICAgQ2NCeU5kID0gJ0NDX0JZX05EJyxcclxuICAgIENjQnlTYSA9ICdDQ19CWV9TQScsXHJcbiAgICBPdGhlciA9ICdPdGhlcicsXHJcbiAgICBSZWRpc3RyaWJ1dGlvblByb2hpYml0ZWQgPSAnUmVkaXN0cmlidXRpb25fUHJvaGliaXRlZCcsXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGUgc2V0dGluZyBvZiBhdXRvbWF0aWMgYW5pbWF0aW9uIG9mIHN0cmluZy1saWtlIG9iamVjdHMgc3VjaCBhcyB0YWlscyBhbmQgaGFpcnMuXHJcbiAgICovXHJcbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb24ge1xyXG4gICAgYm9uZUdyb3Vwcz86IFNlY29uZGFyeUFuaW1hdGlvblNwcmluZ1tdO1xyXG4gICAgY29sbGlkZXJHcm91cHM/OiBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcmdyb3VwW107XHJcbiAgfVxyXG5cclxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvblNwcmluZyB7XHJcbiAgICAvKipcclxuICAgICAqIFNwZWNpZnkgdGhlIG5vZGUgaW5kZXggb2YgdGhlIHJvb3QgYm9uZSBvZiB0aGUgc3dheWluZyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIGJvbmVzPzogbnVtYmVyW107XHJcbiAgICAvKipcclxuICAgICAqIFRoZSByZWZlcmVuY2UgcG9pbnQgb2YgYSBzd2F5aW5nIG9iamVjdCBjYW4gYmUgc2V0IGF0IGFueSBsb2NhdGlvbiBleGNlcHQgdGhlIG9yaWdpbi5cclxuICAgICAqIFdoZW4gaW1wbGVtZW50aW5nIFVJIG1vdmluZyB3aXRoIHdhcnAsIHRoZSBwYXJlbnQgbm9kZSB0byBtb3ZlIHdpdGggd2FycCBjYW4gYmUgc3BlY2lmaWVkXHJcbiAgICAgKiBpZiB5b3UgZG9uJ3Qgd2FudCB0byBtYWtlIHRoZSBvYmplY3Qgc3dheWluZyB3aXRoIHdhcnAgbW92ZW1lbnQuXHJcbiAgICAgKi9cclxuICAgIGNlbnRlcj86IG51bWJlcjtcclxuICAgIC8qKlxyXG4gICAgICogU3BlY2lmeSB0aGUgaW5kZXggb2YgdGhlIGNvbGxpZGVyIGdyb3VwIGZvciBjb2xsaXNpb25zIHdpdGggc3dheWluZyBvYmplY3RzLlxyXG4gICAgICovXHJcbiAgICBjb2xsaWRlckdyb3Vwcz86IG51bWJlcltdO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBbm5vdGF0aW9uIGNvbW1lbnRcclxuICAgICAqL1xyXG4gICAgY29tbWVudD86IHN0cmluZztcclxuICAgIC8qKlxyXG4gICAgICogVGhlIHJlc2lzdGFuY2UgKGRlY2VsZXJhdGlvbikgb2YgYXV0b21hdGljIGFuaW1hdGlvbi5cclxuICAgICAqL1xyXG4gICAgZHJhZ0ZvcmNlPzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgZGlyZWN0aW9uIG9mIGdyYXZpdHkuIFNldCAoMCwgLTEsIDApIGZvciBzaW11bGF0aW5nIHRoZSBncmF2aXR5LiBTZXQgKDEsIDAsIDApIGZvclxyXG4gICAgICogc2ltdWxhdGluZyB0aGUgd2luZC5cclxuICAgICAqL1xyXG4gICAgZ3Jhdml0eURpcj86IFZlY3RvcjM7XHJcbiAgICAvKipcclxuICAgICAqIFRoZSBzdHJlbmd0aCBvZiBncmF2aXR5LlxyXG4gICAgICovXHJcbiAgICBncmF2aXR5UG93ZXI/OiBudW1iZXI7XHJcbiAgICAvKipcclxuICAgICAqIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSB1c2VkIGZvciB0aGUgY29sbGlzaW9uIGRldGVjdGlvbiB3aXRoIGNvbGxpZGVycy5cclxuICAgICAqL1xyXG4gICAgaGl0UmFkaXVzPzogbnVtYmVyO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgcmVzaWxpZW5jZSBvZiB0aGUgc3dheWluZyBvYmplY3QgKHRoZSBwb3dlciBvZiByZXR1cm5pbmcgdG8gdGhlIGluaXRpYWwgcG9zZSkuXHJcbiAgICAgKi9cclxuICAgIHN0aWZmaW5lc3M/OiBudW1iZXI7XHJcbiAgfVxyXG5cclxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyZ3JvdXAge1xyXG4gICAgY29sbGlkZXJzPzogU2Vjb25kYXJ5QW5pbWF0aW9uQ29sbGlkZXJbXTtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIG5vZGUgb2YgdGhlIGNvbGxpZGVyIGdyb3VwIGZvciBzZXR0aW5nIHVwIGNvbGxpc2lvbiBkZXRlY3Rpb25zLlxyXG4gICAgICovXHJcbiAgICBub2RlPzogbnVtYmVyO1xyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlciB7XHJcbiAgICAvKipcclxuICAgICAqIFRoZSBsb2NhbCBjb29yZGluYXRlIGZyb20gdGhlIG5vZGUgb2YgdGhlIGNvbGxpZGVyIGdyb3VwLlxyXG4gICAgICovXHJcbiAgICBvZmZzZXQ/OiBWZWN0b3IzO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgcmFkaXVzIG9mIHRoZSBjb2xsaWRlci5cclxuICAgICAqL1xyXG4gICAgcmFkaXVzPzogbnVtYmVyO1xyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGludGVyZmFjZSBWZWN0b3IzIHtcclxuICAgIHg/OiBudW1iZXI7XHJcbiAgICB5PzogbnVtYmVyO1xyXG4gICAgej86IG51bWJlcjtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHR5cGUgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlcic7XHJcbmltcG9ydCB0eXBlIHsgR0xURlByaW1pdGl2ZSwgR0xURlNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWwoZ2x0ZjogR0xURiwgbm9kZUluZGV4OiBudW1iZXIsIG5vZGU6IFRIUkVFLk9iamVjdDNEKTogR0xURlByaW1pdGl2ZVtdIHwgbnVsbCB7XHJcbiAgLyoqXHJcbiAgICogTGV0J3MgbGlzdCB1cCBldmVyeSBwb3NzaWJsZSBwYXR0ZXJucyB0aGF0IHBhcnNlZCBnbHRmIG5vZGVzIHdpdGggYSBtZXNoIGNhbiBoYXZlLCwsXHJcbiAgICpcclxuICAgKiBcIipcIiBpbmRpY2F0ZXMgdGhhdCB0aG9zZSBtZXNoZXMgc2hvdWxkIGJlIGxpc3RlZCB1cCB1c2luZyB0aGlzIGZ1bmN0aW9uXHJcbiAgICpcclxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgYSBzaWdubGUgcHJpbWl0aXZlKVxyXG4gICAqXHJcbiAgICogLSBgVEhSRUUuTWVzaGA6IFRoZSBvbmx5IHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXHJcbiAgICpcclxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcylcclxuICAgKlxyXG4gICAqIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcclxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXHJcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcclxuICAgKlxyXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBBTkQgKGEgY2hpbGQgd2l0aCBhIG1lc2gsIGEgc2luZ2xlIHByaW1pdGl2ZSlcclxuICAgKlxyXG4gICAqIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcclxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXHJcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcclxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiBhIE1FU0ggT0YgVEhFIENISUxEXHJcbiAgICpcclxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxyXG4gICAqXHJcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxyXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcclxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxyXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiBhIE1FU0ggT0YgVEhFIENISUxEXHJcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcclxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZCAoMilcclxuICAgKlxyXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXHJcbiAgICpcclxuICAgKiAtIGBUSFJFRS5Cb25lYDogVGhlIHJvb3Qgb2YgdGhlIG5vZGUsIGFzIGEgYm9uZVxyXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxyXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxyXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcclxuICAgKlxyXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBBTkQgKGEgY2hpbGQgd2l0aCBhIG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEJVVCB0aGUgbm9kZSBpcyBhIGJvbmVcclxuICAgKlxyXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXHJcbiAgICogICAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXHJcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXHJcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxyXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiBhIE1FU0ggT0YgVEhFIENISUxEXHJcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcclxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZCAoMilcclxuICAgKlxyXG4gICAqIC4uLkkgd2lsbCB0YWtlIGEgc3RyYXRlZ3kgdGhhdCB0cmF2ZXJzZXMgdGhlIHJvb3Qgb2YgdGhlIG5vZGUgYW5kIHRha2UgZmlyc3QgKHByaW1pdGl2ZUNvdW50KSBtZXNoZXMuXHJcbiAgICovXHJcblxyXG4gIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBub2RlIGhhcyBhIG1lc2hcclxuICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XHJcbiAgY29uc3QgbWVzaEluZGV4ID0gc2NoZW1hTm9kZS5tZXNoO1xyXG4gIGlmIChtZXNoSW5kZXggPT0gbnVsbCkge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICAvLyBIb3cgbWFueSBwcmltaXRpdmVzIHRoZSBtZXNoIGhhcz9cclxuICBjb25zdCBzY2hlbWFNZXNoOiBHTFRGU2NoZW1hLk1lc2ggPSBnbHRmLnBhcnNlci5qc29uLm1lc2hlc1ttZXNoSW5kZXhdO1xyXG4gIGNvbnN0IHByaW1pdGl2ZUNvdW50ID0gc2NoZW1hTWVzaC5wcmltaXRpdmVzLmxlbmd0aDtcclxuXHJcbiAgLy8gVHJhdmVyc2UgdGhlIG5vZGUgYW5kIHRha2UgZmlyc3QgKHByaW1pdGl2ZUNvdW50KSBtZXNoZXNcclxuICBjb25zdCBwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10gPSBbXTtcclxuICBub2RlLnRyYXZlcnNlKChvYmplY3QpID0+IHtcclxuICAgIGlmIChwcmltaXRpdmVzLmxlbmd0aCA8IHByaW1pdGl2ZUNvdW50KSB7XHJcbiAgICAgIGlmICgob2JqZWN0IGFzIGFueSkuaXNNZXNoKSB7XHJcbiAgICAgICAgcHJpbWl0aXZlcy5wdXNoKG9iamVjdCBhcyBHTFRGUHJpbWl0aXZlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gcHJpbWl0aXZlcztcclxufVxyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3QgcHJpbWl0aXZlcyAoIGBUSFJFRS5NZXNoW11gICkgb2YgYSBub2RlIGZyb20gYSBsb2FkZWQgR0xURi5cclxuICogVGhlIG1haW4gcHVycG9zZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHRvIGRpc3Rpbmd1aXNoIHByaW1pdGl2ZXMgYW5kIGNoaWxkcmVuIGZyb20gYSBub2RlIHRoYXQgaGFzIGJvdGggbWVzaGVzIGFuZCBjaGlsZHJlbi5cclxuICpcclxuICogSXQgdXRpbGl6ZXMgdGhlIGJlaGF2aW9yIHRoYXQgR0xURkxvYWRlciBhZGRzIG1lc2ggcHJpbWl0aXZlcyB0byB0aGUgbm9kZSBvYmplY3QgKCBgVEhSRUUuR3JvdXBgICkgZmlyc3QgdGhlbiBhZGRzIGl0cyBjaGlsZHJlbi5cclxuICpcclxuICogQHBhcmFtIGdsdGYgQSBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICogQHBhcmFtIG5vZGVJbmRleCBUaGUgaW5kZXggb2YgdGhlIG5vZGVcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZShnbHRmOiBHTFRGLCBub2RlSW5kZXg6IG51bWJlcik6IFByb21pc2U8R0xURlByaW1pdGl2ZVtdIHwgbnVsbD4ge1xyXG4gIGNvbnN0IG5vZGU6IFRIUkVFLk9iamVjdDNEID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIG5vZGVJbmRleCk7XHJcbiAgcmV0dXJuIGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWwoZ2x0Ziwgbm9kZUluZGV4LCBub2RlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3QgcHJpbWl0aXZlcyAoIGBUSFJFRS5NZXNoW11gICkgb2Ygbm9kZXMgZnJvbSBhIGxvYWRlZCBHTFRGLlxyXG4gKiBTZWUge0BsaW5rIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlfSBmb3IgbW9yZSBkZXRhaWxzLlxyXG4gKlxyXG4gKiBJdCByZXR1cm5zIGEgbWFwIGZyb20gbm9kZSBpbmRleCB0byBleHRyYWN0aW9uIHJlc3VsdC5cclxuICogSWYgYSBub2RlIGRvZXMgbm90IGhhdmUgYSBtZXNoLCB0aGUgZW50cnkgZm9yIHRoZSBub2RlIHdpbGwgbm90IGJlIHB1dCBpbiB0aGUgcmV0dXJuaW5nIG1hcC5cclxuICpcclxuICogQHBhcmFtIGdsdGYgQSBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMoZ2x0ZjogR0xURik6IFByb21pc2U8TWFwPG51bWJlciwgR0xURlByaW1pdGl2ZVtdPj4ge1xyXG4gIGNvbnN0IG5vZGVzOiBUSFJFRS5PYmplY3QzRFtdID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jaWVzKCdub2RlJyk7XHJcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxudW1iZXIsIEdMVEZQcmltaXRpdmVbXT4oKTtcclxuXHJcbiAgbm9kZXMuZm9yRWFjaCgobm9kZSwgaW5kZXgpID0+IHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWwoZ2x0ZiwgaW5kZXgsIG5vZGUpO1xyXG4gICAgaWYgKHJlc3VsdCAhPSBudWxsKSB7XHJcbiAgICAgIG1hcC5zZXQoaW5kZXgsIHJlc3VsdCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiBtYXA7XHJcbn1cclxuIiwiZXhwb3J0IGZ1bmN0aW9uIHJlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICBpZiAobmFtZVswXSAhPT0gJ18nKSB7XHJcbiAgICBjb25zb2xlLndhcm4oYHJlbmFtZU1hdGVyaWFsUHJvcGVydHk6IEdpdmVuIHByb3BlcnR5IG5hbWUgXCIke25hbWV9XCIgbWlnaHQgYmUgaW52YWxpZGApO1xyXG4gICAgcmV0dXJuIG5hbWU7XHJcbiAgfVxyXG4gIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcclxuXHJcbiAgaWYgKCEvW0EtWl0vLnRlc3QobmFtZVswXSkpIHtcclxuICAgIGNvbnNvbGUud2FybihgcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eTogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XHJcbiAgICByZXR1cm4gbmFtZTtcclxuICB9XHJcbiAgcmV0dXJuIG5hbWVbMF0udG9Mb3dlckNhc2UoKSArIG5hbWUuc3Vic3RyaW5nKDEpO1xyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuXHJcbi8qKlxyXG4gKiBDbGFtcCBhbiBpbnB1dCBudW1iZXIgd2l0aGluIFsgYDAuMGAgLSBgMS4wYCBdLlxyXG4gKlxyXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGlucHV0IHZhbHVlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2F0dXJhdGUodmFsdWU6IG51bWJlcik6IG51bWJlciB7XHJcbiAgcmV0dXJuIE1hdGgubWF4KE1hdGgubWluKHZhbHVlLCAxLjApLCAwLjApO1xyXG59XHJcblxyXG4vKipcclxuICogTWFwIHRoZSByYW5nZSBvZiBhbiBpbnB1dCB2YWx1ZSBmcm9tIFsgYG1pbmAgLSBgbWF4YCBdIHRvIFsgYDAuMGAgLSBgMS4wYCBdLlxyXG4gKiBJZiBpbnB1dCB2YWx1ZSBpcyBsZXNzIHRoYW4gYG1pbmAgLCBpdCByZXR1cm5zIGAwLjBgLlxyXG4gKiBJZiBpbnB1dCB2YWx1ZSBpcyBncmVhdGVyIHRoYW4gYG1heGAgLCBpdCByZXR1cm5zIGAxLjBgLlxyXG4gKlxyXG4gKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vbWF0aC9NYXRoLnNtb290aHN0ZXBcclxuICpcclxuICogQHBhcmFtIHggVGhlIHZhbHVlIHRoYXQgd2lsbCBiZSBtYXBwZWQgaW50byB0aGUgc3BlY2lmaWVkIHJhbmdlXHJcbiAqIEBwYXJhbSBtaW4gTWluaW11bSB2YWx1ZSBvZiB0aGUgcmFuZ2VcclxuICogQHBhcmFtIG1heCBNYXhpbXVtIHZhbHVlIG9mIHRoZSByYW5nZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxpbnN0ZXAoeDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xyXG4gIGlmICh4IDw9IG1pbikgcmV0dXJuIDA7XHJcbiAgaWYgKHggPj0gbWF4KSByZXR1cm4gMTtcclxuXHJcbiAgcmV0dXJuICh4IC0gbWluKSAvIChtYXggLSBtaW4pO1xyXG59XHJcblxyXG5jb25zdCBfcG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfc2NhbGUgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfcm90YXRpb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3Qgd29ybGQgcG9zaXRpb24gb2YgYW4gb2JqZWN0IGZyb20gaXRzIHdvcmxkIHNwYWNlIG1hdHJpeCwgaW4gY2hlYXBlciB3YXkuXHJcbiAqXHJcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxyXG4gKiBAcGFyYW0gb3V0IFRhcmdldCB2ZWN0b3JcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFBvc2l0aW9uTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcclxuICBvYmplY3QubWF0cml4V29ybGQuZGVjb21wb3NlKG91dCwgX3JvdGF0aW9uLCBfc2NhbGUpO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFeHRyYWN0IHdvcmxkIHNjYWxlIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxyXG4gKlxyXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcclxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRTY2FsZUxpdGUob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgb3V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XHJcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShfcG9zaXRpb24sIF9yb3RhdGlvbiwgb3V0KTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogRXh0cmFjdCB3b3JsZCByb3RhdGlvbiBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cclxuICpcclxuICogQHBhcmFtIG9iamVjdCBUaGUgb2JqZWN0XHJcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFdvcmxkUXVhdGVybmlvbkxpdGUob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgb3V0OiBUSFJFRS5RdWF0ZXJuaW9uKTogVEhSRUUuUXVhdGVybmlvbiB7XHJcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShfcG9zaXRpb24sIG91dCwgX3NjYWxlKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcbiIsImltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgc2F0dXJhdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcclxuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZUdyb3VwIH0gZnJvbSAnLi9WUk1CbGVuZFNoYXBlR3JvdXAnO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTUJsZW5kU2hhcGVQcm94eSB7XHJcbiAgLyoqXHJcbiAgICogTGlzdCBvZiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2JsZW5kU2hhcGVHcm91cHM6IHsgW25hbWU6IHN0cmluZ106IFZSTUJsZW5kU2hhcGVHcm91cCB9ID0ge307XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgbWFwIGZyb20gW1tWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdXSB0byBpdHMgYWN0dWFsIGJsZW5kIHNoYXBlIG5hbWUuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZVByZXNldE1hcDogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0gPSB7fTtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBsaXN0IG9mIG5hbWUgb2YgdW5rbm93biBibGVuZCBzaGFwZXMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfdW5rbm93bkdyb3VwTmFtZXM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1CbGVuZFNoYXBlLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcclxuICAgIC8vIGRvIG5vdGhpbmdcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIExpc3Qgb2YgbmFtZSBvZiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlIGdyb3VwLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgZXhwcmVzc2lvbnMoKTogc3RyaW5nW10ge1xyXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBtYXAgZnJvbSBbW1ZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV1dIHRvIGl0cyBhY3R1YWwgYmxlbmQgc2hhcGUgbmFtZS5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IGJsZW5kU2hhcGVQcmVzZXRNYXAoKTogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0ge1xyXG4gICAgcmV0dXJuIHRoaXMuX2JsZW5kU2hhcGVQcmVzZXRNYXA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBIGxpc3Qgb2YgbmFtZSBvZiB1bmtub3duIGJsZW5kIHNoYXBlcy5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IHVua25vd25Hcm91cE5hbWVzKCk6IHN0cmluZ1tdIHtcclxuICAgIHJldHVybiB0aGlzLl91bmtub3duR3JvdXBOYW1lcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlIGdyb3VwLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0QmxlbmRTaGFwZUdyb3VwKG5hbWU6IHN0cmluZyB8IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSk6IFZSTUJsZW5kU2hhcGVHcm91cCB8IHVuZGVmaW5lZCB7XHJcbiAgICBjb25zdCBwcmVzZXROYW1lID0gdGhpcy5fYmxlbmRTaGFwZVByZXNldE1hcFtuYW1lIGFzIFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV07XHJcbiAgICBjb25zdCBjb250cm9sbGVyID0gcHJlc2V0TmFtZSA/IHRoaXMuX2JsZW5kU2hhcGVHcm91cHNbcHJlc2V0TmFtZV0gOiB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xyXG4gICAgaWYgKCFjb250cm9sbGVyKSB7XHJcbiAgICAgIGNvbnNvbGUud2Fybihgbm8gYmxlbmQgc2hhcGUgZm91bmQgYnkgJHtuYW1lfWApO1xyXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvbnRyb2xsZXI7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBhIGJsZW5kIHNoYXBlIGdyb3VwLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ29ydXBcclxuICAgKiBAcGFyYW0gY29udHJvbGxlciBWUk1CbGVuZFNoYXBlQ29udHJvbGxlciB0aGF0IGRlc2NyaWJlcyB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcclxuICAgKi9cclxuICBwdWJsaWMgcmVnaXN0ZXJCbGVuZFNoYXBlR3JvdXAoXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBwcmVzZXROYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCB1bmRlZmluZWQsXHJcbiAgICBjb250cm9sbGVyOiBWUk1CbGVuZFNoYXBlR3JvdXAsXHJcbiAgKTogdm9pZCB7XHJcbiAgICB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdID0gY29udHJvbGxlcjtcclxuICAgIGlmIChwcmVzZXROYW1lKSB7XHJcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcmVzZXRNYXBbcHJlc2V0TmFtZV0gPSBuYW1lO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fdW5rbm93bkdyb3VwTmFtZXMucHVzaChuYW1lKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjdXJyZW50IHdlaWdodCBvZiBzcGVjaWZpZWQgYmxlbmQgc2hhcGUgZ3JvdXAuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRWYWx1ZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcclxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldEJsZW5kU2hhcGVHcm91cChuYW1lKTtcclxuICAgIHJldHVybiBjb250cm9sbGVyPy53ZWlnaHQgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCBhIHdlaWdodCB0byBzcGVjaWZpZWQgYmxlbmQgc2hhcGUgZ3JvdXAuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxyXG4gICAqIEBwYXJhbSB3ZWlnaHQgV2VpZ2h0XHJcbiAgICovXHJcbiAgcHVibGljIHNldFZhbHVlKG5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHN0cmluZywgd2VpZ2h0OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldEJsZW5kU2hhcGVHcm91cChuYW1lKTtcclxuICAgIGlmIChjb250cm9sbGVyKSB7XHJcbiAgICAgIGNvbnRyb2xsZXIud2VpZ2h0ID0gc2F0dXJhdGUod2VpZ2h0KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHRyYWNrIG5hbWUgb2Ygc3BlY2lmaWVkIGJsZW5kIHNoYXBlIGdyb3VwLlxyXG4gICAqIFRoaXMgdHJhY2sgbmFtZSBpcyBuZWVkZWQgdG8gbWFuaXB1bGF0ZSBpdHMgYmxlbmQgc2hhcGUgZ3JvdXAgdmlhIGtleWZyYW1lIGFuaW1hdGlvbnMuXHJcbiAgICpcclxuICAgKiBAZXhhbXBsZSBNYW5pcHVsYXRlIGEgYmxlbmQgc2hhcGUgZ3JvdXAgdXNpbmcga2V5ZnJhbWUgYW5pbWF0aW9uXHJcbiAgICogYGBganNcclxuICAgKiBjb25zdCB0cmFja05hbWUgPSB2cm0uYmxlbmRTaGFwZVByb3h5LmdldEJsZW5kU2hhcGVUcmFja05hbWUoIFRIUkVFLlZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5CbGluayApO1xyXG4gICAqIGNvbnN0IHRyYWNrID0gbmV3IFRIUkVFLk51bWJlcktleWZyYW1lVHJhY2soXHJcbiAgICogICBuYW1lLFxyXG4gICAqICAgWyAwLjAsIDAuNSwgMS4wIF0sIC8vIHRpbWVzXHJcbiAgICogICBbIDAuMCwgMS4wLCAwLjAgXSAvLyB2YWx1ZXNcclxuICAgKiApO1xyXG4gICAqXHJcbiAgICogY29uc3QgY2xpcCA9IG5ldyBUSFJFRS5BbmltYXRpb25DbGlwKFxyXG4gICAqICAgJ2JsaW5rJywgLy8gbmFtZVxyXG4gICAqICAgMS4wLCAvLyBkdXJhdGlvblxyXG4gICAqICAgWyB0cmFjayBdIC8vIHRyYWNrc1xyXG4gICAqICk7XHJcbiAgICpcclxuICAgKiBjb25zdCBtaXhlciA9IG5ldyBUSFJFRS5BbmltYXRpb25NaXhlciggdnJtLnNjZW5lICk7XHJcbiAgICogY29uc3QgYWN0aW9uID0gbWl4ZXIuY2xpcEFjdGlvbiggY2xpcCApO1xyXG4gICAqIGFjdGlvbi5wbGF5KCk7XHJcbiAgICogYGBgXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRCbGVuZFNoYXBlVHJhY2tOYW1lKG5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuZ2V0QmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xyXG4gICAgcmV0dXJuIGNvbnRyb2xsZXIgPyBgJHtjb250cm9sbGVyLm5hbWV9LndlaWdodGAgOiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGV2ZXJ5IGJsZW5kIHNoYXBlIGdyb3Vwcy5cclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlKCk6IHZvaWQge1xyXG4gICAgT2JqZWN0LmtleXModGhpcy5fYmxlbmRTaGFwZUdyb3VwcykuZm9yRWFjaCgobmFtZSkgPT4ge1xyXG4gICAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcclxuICAgICAgY29udHJvbGxlci5jbGVhckFwcGxpZWRXZWlnaHQoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpLmZvckVhY2goKG5hbWUpID0+IHtcclxuICAgICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuX2JsZW5kU2hhcGVHcm91cHNbbmFtZV07XHJcbiAgICAgIGNvbnRyb2xsZXIuYXBwbHlXZWlnaHQoKTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcclxuaW1wb3J0IHsgR0xURlNjaGVtYSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcclxuaW1wb3J0IHsgcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eSB9IGZyb20gJy4uL3V0aWxzL3JlbmFtZU1hdGVyaWFsUHJvcGVydHknO1xyXG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlR3JvdXAgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVHcm91cCc7XHJcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZVByb3h5JztcclxuXHJcbi8qKlxyXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUJsZW5kU2hhcGVdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNQmxlbmRTaGFwZUltcG9ydGVyIHtcclxuICAvKipcclxuICAgKiBJbXBvcnQgYSBbW1ZSTUJsZW5kU2hhcGVdXSBmcm9tIGEgVlJNLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1CbGVuZFNoYXBlUHJveHkgfCBudWxsPiB7XHJcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcclxuICAgIGlmICghdnJtRXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjaGVtYUJsZW5kU2hhcGU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlIHwgdW5kZWZpbmVkID0gdnJtRXh0LmJsZW5kU2hhcGVNYXN0ZXI7XHJcbiAgICBpZiAoIXNjaGVtYUJsZW5kU2hhcGUpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYmxlbmRTaGFwZSA9IG5ldyBWUk1CbGVuZFNoYXBlUHJveHkoKTtcclxuXHJcbiAgICBjb25zdCBibGVuZFNoYXBlR3JvdXBzOiBWUk1TY2hlbWEuQmxlbmRTaGFwZUdyb3VwW10gfCB1bmRlZmluZWQgPSBzY2hlbWFCbGVuZFNoYXBlLmJsZW5kU2hhcGVHcm91cHM7XHJcbiAgICBpZiAoIWJsZW5kU2hhcGVHcm91cHMpIHtcclxuICAgICAgcmV0dXJuIGJsZW5kU2hhcGU7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYmxlbmRTaGFwZVByZXNldE1hcDogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0gPSB7fTtcclxuXHJcbiAgICBhd2FpdCBQcm9taXNlLmFsbChcclxuICAgICAgYmxlbmRTaGFwZUdyb3Vwcy5tYXAoYXN5bmMgKHNjaGVtYUdyb3VwKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbmFtZSA9IHNjaGVtYUdyb3VwLm5hbWU7XHJcbiAgICAgICAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgY29uc29sZS53YXJuKCdWUk1CbGVuZFNoYXBlSW1wb3J0ZXI6IE9uZSBvZiBibGVuZFNoYXBlR3JvdXBzIGhhcyBubyBuYW1lJyk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcHJlc2V0TmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIHNjaGVtYUdyb3VwLnByZXNldE5hbWUgJiZcclxuICAgICAgICAgIHNjaGVtYUdyb3VwLnByZXNldE5hbWUgIT09IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Vbmtub3duICYmXHJcbiAgICAgICAgICAhYmxlbmRTaGFwZVByZXNldE1hcFtzY2hlbWFHcm91cC5wcmVzZXROYW1lXVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgcHJlc2V0TmFtZSA9IHNjaGVtYUdyb3VwLnByZXNldE5hbWU7XHJcbiAgICAgICAgICBibGVuZFNoYXBlUHJlc2V0TWFwW3NjaGVtYUdyb3VwLnByZXNldE5hbWVdID0gbmFtZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGdyb3VwID0gbmV3IFZSTUJsZW5kU2hhcGVHcm91cChuYW1lKTtcclxuICAgICAgICBnbHRmLnNjZW5lLmFkZChncm91cCk7XHJcblxyXG4gICAgICAgIGdyb3VwLmlzQmluYXJ5ID0gc2NoZW1hR3JvdXAuaXNCaW5hcnkgfHwgZmFsc2U7XHJcblxyXG4gICAgICAgIGlmIChzY2hlbWFHcm91cC5iaW5kcykge1xyXG4gICAgICAgICAgc2NoZW1hR3JvdXAuYmluZHMuZm9yRWFjaChhc3luYyAoYmluZCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoYmluZC5tZXNoID09PSB1bmRlZmluZWQgfHwgYmluZC5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBub2Rlc1VzaW5nTWVzaDogbnVtYmVyW10gPSBbXTtcclxuICAgICAgICAgICAgKGdsdGYucGFyc2VyLmpzb24ubm9kZXMgYXMgR0xURlNjaGVtYS5Ob2RlW10pLmZvckVhY2goKG5vZGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICBpZiAobm9kZS5tZXNoID09PSBiaW5kLm1lc2gpIHtcclxuICAgICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLnB1c2goaSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0SW5kZXggPSBiaW5kLmluZGV4O1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICAgICAgbm9kZXNVc2luZ01lc2gubWFwKGFzeW5jIChub2RlSW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZXMgPSAoYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUoZ2x0Ziwgbm9kZUluZGV4KSkhO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRoZSBtZXNoIGhhcyB0aGUgdGFyZ2V0IG1vcnBoIHRhcmdldFxyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAhcHJpbWl0aXZlcy5ldmVyeShcclxuICAgICAgICAgICAgICAgICAgICAocHJpbWl0aXZlKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzKSAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCA8IHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgICAgICAgIGBWUk1CbGVuZFNoYXBlSW1wb3J0ZXI6ICR7c2NoZW1hR3JvdXAubmFtZX0gYXR0ZW1wdHMgdG8gaW5kZXggJHttb3JwaFRhcmdldEluZGV4fXRoIG1vcnBoIGJ1dCBub3QgZm91bmQuYCxcclxuICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGdyb3VwLmFkZEJpbmQoe1xyXG4gICAgICAgICAgICAgICAgICBtZXNoZXM6IHByaW1pdGl2ZXMsXHJcbiAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0SW5kZXgsXHJcbiAgICAgICAgICAgICAgICAgIHdlaWdodDogYmluZC53ZWlnaHQgPz8gMTAwLFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IG1hdGVyaWFsVmFsdWVzID0gc2NoZW1hR3JvdXAubWF0ZXJpYWxWYWx1ZXM7XHJcbiAgICAgICAgaWYgKG1hdGVyaWFsVmFsdWVzKSB7XHJcbiAgICAgICAgICBtYXRlcmlhbFZhbHVlcy5mb3JFYWNoKChtYXRlcmlhbFZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWUgPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUgPT09IHVuZGVmaW5lZFxyXG4gICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsczogVEhSRUUuTWF0ZXJpYWxbXSA9IFtdO1xyXG4gICAgICAgICAgICBnbHRmLnNjZW5lLnRyYXZlcnNlKChvYmplY3QpID0+IHtcclxuICAgICAgICAgICAgICBpZiAoKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWxbXSB8IFRIUkVFLk1hdGVyaWFsID0gKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsO1xyXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWF0ZXJpYWwpKSB7XHJcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKFxyXG4gICAgICAgICAgICAgICAgICAgIC4uLm1hdGVyaWFsLmZpbHRlcihcclxuICAgICAgICAgICAgICAgICAgICAgIChtdGwpID0+IG10bC5uYW1lID09PSBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSEgJiYgbWF0ZXJpYWxzLmluZGV4T2YobXRsKSA9PT0gLTEsXHJcbiAgICAgICAgICAgICAgICAgICAgKSxcclxuICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWwubmFtZSA9PT0gbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUgJiYgbWF0ZXJpYWxzLmluZGV4T2YobWF0ZXJpYWwpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIG1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbCkgPT4ge1xyXG4gICAgICAgICAgICAgIGdyb3VwLmFkZE1hdGVyaWFsVmFsdWUoe1xyXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwsXHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eU5hbWU6IHJlbmFtZU1hdGVyaWFsUHJvcGVydHkobWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWUhKSxcclxuICAgICAgICAgICAgICAgIHRhcmdldFZhbHVlOiBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlISxcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGJsZW5kU2hhcGUucmVnaXN0ZXJCbGVuZFNoYXBlR3JvdXAobmFtZSwgcHJlc2V0TmFtZSwgZ3JvdXApO1xyXG4gICAgICB9KSxcclxuICAgICk7XHJcblxyXG4gICAgcmV0dXJuIGJsZW5kU2hhcGU7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgR0xURk5vZGUsIEdMVEZQcmltaXRpdmUgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IGdldFdvcmxkUXVhdGVybmlvbkxpdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcclxuXHJcbmNvbnN0IFZFQ1RPUjNfRlJPTlQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAtMS4wKSk7XHJcblxyXG5jb25zdCBfcXVhdCA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcblxyXG5lbnVtIEZpcnN0UGVyc29uRmxhZyB7XHJcbiAgQXV0byxcclxuICBCb3RoLFxyXG4gIFRoaXJkUGVyc29uT25seSxcclxuICBGaXJzdFBlcnNvbk9ubHksXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBzaW5nbGUgW2BtZXNoQW5ub3RhdGlvbmBdKGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi9tYXN0ZXIvc3BlY2lmaWNhdGlvbi8wLjAvc2NoZW1hL3ZybS5maXJzdHBlcnNvbi5tZXNoYW5ub3RhdGlvbi5zY2hlbWEuanNvbikgZW50cnkuXHJcbiAqIEVhY2ggbWVzaCB3aWxsIGJlIGFzc2lnbmVkIHRvIHNwZWNpZmllZCBsYXllciB3aGVuIHlvdSBjYWxsIFtbVlJNRmlyc3RQZXJzb24uc2V0dXBdXS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3Mge1xyXG4gIHByaXZhdGUgc3RhdGljIF9wYXJzZUZpcnN0UGVyc29uRmxhZyhmaXJzdFBlcnNvbkZsYWc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IEZpcnN0UGVyc29uRmxhZyB7XHJcbiAgICBzd2l0Y2ggKGZpcnN0UGVyc29uRmxhZykge1xyXG4gICAgICBjYXNlICdCb3RoJzpcclxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLkJvdGg7XHJcbiAgICAgIGNhc2UgJ1RoaXJkUGVyc29uT25seSc6XHJcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5UaGlyZFBlcnNvbk9ubHk7XHJcbiAgICAgIGNhc2UgJ0ZpcnN0UGVyc29uT25seSc6XHJcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5GaXJzdFBlcnNvbk9ubHk7XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5BdXRvO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBbW0ZpcnN0UGVyc29uRmxhZ11dIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBmaXJzdFBlcnNvbkZsYWc6IEZpcnN0UGVyc29uRmxhZztcclxuXHJcbiAgLyoqXHJcbiAgICogQSBtZXNoIHByaW1pdGl2ZXMgb2YgdGhlIGFubm90YXRpb24gZW50cnkuXHJcbiAgICovXHJcbiAgcHVibGljIHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IG1lc2ggYW5ub3RhdGlvbi5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbkZsYWcgQSBbW0ZpcnN0UGVyc29uRmxhZ11dIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5XHJcbiAgICogQHBhcmFtIG5vZGUgQSBub2RlIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5LlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGZpcnN0UGVyc29uRmxhZzogc3RyaW5nIHwgdW5kZWZpbmVkLCBwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10pIHtcclxuICAgIHRoaXMuZmlyc3RQZXJzb25GbGFnID0gVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzLl9wYXJzZUZpcnN0UGVyc29uRmxhZyhmaXJzdFBlcnNvbkZsYWcpO1xyXG4gICAgdGhpcy5wcmltaXRpdmVzID0gcHJpbWl0aXZlcztcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1GaXJzdFBlcnNvbiB7XHJcbiAgLyoqXHJcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYEZpcnN0UGVyc29uT25seWAgbGF5ZXIuXHJcbiAgICpcclxuICAgKiBAc2VlIFtbZ2V0Rmlyc3RQZXJzb25Pbmx5TGF5ZXJdXVxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9ERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVIgPSA5O1xyXG5cclxuICAvKipcclxuICAgKiBBIGRlZmF1bHQgY2FtZXJhIGxheWVyIGZvciBgVGhpcmRQZXJzb25Pbmx5YCBsYXllci5cclxuICAgKlxyXG4gICAqIEBzZWUgW1tnZXRUaGlyZFBlcnNvbk9ubHlMYXllcl1dXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0RFRkFVTFRfVEhJUkRQRVJTT05fT05MWV9MQVlFUiA9IDEwO1xyXG5cclxuICBwcml2YXRlIHJlYWRvbmx5IF9maXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX21lc2hBbm5vdGF0aW9uczogVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzW10gPSBbXTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9maXJzdFBlcnNvbkJvbmVPZmZzZXQ6IFRIUkVFLlZlY3RvcjM7XHJcblxyXG4gIHByaXZhdGUgX2ZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUjtcclxuICBwcml2YXRlIF90aGlyZFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVI7XHJcblxyXG4gIHByaXZhdGUgX2luaXRpYWxpemVkID0gZmFsc2U7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1GaXJzdFBlcnNvbiBvYmplY3QuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb25Cb25lIEEgZmlyc3QgcGVyc29uIGJvbmVcclxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb25Cb25lT2Zmc2V0IEFuIG9mZnNldCBmcm9tIHRoZSBzcGVjaWZpZWQgZmlyc3QgcGVyc29uIGJvbmVcclxuICAgKiBAcGFyYW0gbWVzaEFubm90YXRpb25zIEEgcmVuZGVyZXIgc2V0dGluZ3MuIFNlZSB0aGUgZGVzY3JpcHRpb24gb2YgW1tSZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NdXSBmb3IgbW9yZSBpbmZvXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBmaXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlLFxyXG4gICAgZmlyc3RQZXJzb25Cb25lT2Zmc2V0OiBUSFJFRS5WZWN0b3IzLFxyXG4gICAgbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSxcclxuICApIHtcclxuICAgIHRoaXMuX2ZpcnN0UGVyc29uQm9uZSA9IGZpcnN0UGVyc29uQm9uZTtcclxuICAgIHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldCA9IGZpcnN0UGVyc29uQm9uZU9mZnNldDtcclxuICAgIHRoaXMuX21lc2hBbm5vdGF0aW9ucyA9IG1lc2hBbm5vdGF0aW9ucztcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgZmlyc3RQZXJzb25Cb25lKCk6IEdMVEZOb2RlIHtcclxuICAgIHJldHVybiB0aGlzLl9maXJzdFBlcnNvbkJvbmU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG1lc2hBbm5vdGF0aW9ucygpOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5fbWVzaEFubm90YXRpb25zO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldEZpcnN0UGVyc29uV29ybGREaXJlY3Rpb24odGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XHJcbiAgICByZXR1cm4gdGFyZ2V0LmNvcHkoVkVDVE9SM19GUk9OVCkuYXBwbHlRdWF0ZXJuaW9uKGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5fZmlyc3RQZXJzb25Cb25lLCBfcXVhdCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBjYW1lcmEgbGF5ZXIgcmVwcmVzZW50cyBgRmlyc3RQZXJzb25Pbmx5YCBsYXllci5cclxuICAgKiBOb3RlIHRoYXQgKip5b3UgbXVzdCBjYWxsIFtbc2V0dXBdXSBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZSoqIG9yIGl0IGRvZXMgbm90IHdvcmsgcHJvcGVybHkuXHJcbiAgICpcclxuICAgKiBUaGUgdmFsdWUgaXMgW1tERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVJdXSBieSBkZWZhdWx0IGJ1dCB5b3UgY2FuIGNoYW5nZSB0aGUgbGF5ZXIgYnkgc3BlY2lmeWluZyB2aWEgW1tzZXR1cF1dIGlmIHlvdSBwcmVmZXIuXHJcbiAgICpcclxuICAgKiBAc2VlIGh0dHBzOi8vdnJtLmRldi9lbi91bml2cm0vYXBpL3VuaXZybV91c2VfZmlyc3RwZXJzb24vXHJcbiAgICogQHNlZSBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9jb3JlL0xheWVyc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgZmlyc3RQZXJzb25Pbmx5TGF5ZXIoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgY2FtZXJhIGxheWVyIHJlcHJlc2VudHMgYFRoaXJkUGVyc29uT25seWAgbGF5ZXIuXHJcbiAgICogTm90ZSB0aGF0ICoqeW91IG11c3QgY2FsbCBbW3NldHVwXV0gZmlyc3QgYmVmb3JlIHlvdSB1c2UgdGhlIGxheWVyIGZlYXR1cmUqKiBvciBpdCBkb2VzIG5vdCB3b3JrIHByb3Blcmx5LlxyXG4gICAqXHJcbiAgICogVGhlIHZhbHVlIGlzIFtbREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSXV0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIFtbc2V0dXBdXSBpZiB5b3UgcHJlZmVyLlxyXG4gICAqXHJcbiAgICogQHNlZSBodHRwczovL3ZybS5kZXYvZW4vdW5pdnJtL2FwaS91bml2cm1fdXNlX2ZpcnN0cGVyc29uL1xyXG4gICAqIEBzZWUgaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vY29yZS9MYXllcnNcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IHRoaXJkUGVyc29uT25seUxheWVyKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXI7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Cb25lT2Zmc2V0KHRhcmdldDogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xyXG4gICAgcmV0dXJuIHRhcmdldC5jb3B5KHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgY3VycmVudCB3b3JsZCBwb3NpdGlvbiBvZiB0aGUgZmlyc3QgcGVyc29uLlxyXG4gICAqIFRoZSBwb3NpdGlvbiB0YWtlcyBbW0ZpcnN0UGVyc29uQm9uZV1dIGFuZCBbW0ZpcnN0UGVyc29uT2Zmc2V0XV0gaW50byBhY2NvdW50LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHYzIHRhcmdldFxyXG4gICAqIEByZXR1cm5zIEN1cnJlbnQgd29ybGQgcG9zaXRpb24gb2YgdGhlIGZpcnN0IHBlcnNvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRGaXJzdFBlcnNvbldvcmxkUG9zaXRpb24odjM6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcclxuICAgIC8vIFVuaVZSTSNWUk1GaXJzdFBlcnNvbkVkaXRvclxyXG4gICAgLy8gdmFyIHdvcmxkT2Zmc2V0ID0gaGVhZC5sb2NhbFRvV29ybGRNYXRyaXguTXVsdGlwbHlQb2ludChjb21wb25lbnQuRmlyc3RQZXJzb25PZmZzZXQpO1xyXG4gICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5fZmlyc3RQZXJzb25Cb25lT2Zmc2V0O1xyXG4gICAgY29uc3QgdjQgPSBuZXcgVEhSRUUuVmVjdG9yNChvZmZzZXQueCwgb2Zmc2V0LnksIG9mZnNldC56LCAxLjApO1xyXG4gICAgdjQuYXBwbHlNYXRyaXg0KHRoaXMuX2ZpcnN0UGVyc29uQm9uZS5tYXRyaXhXb3JsZCk7XHJcbiAgICByZXR1cm4gdjMuc2V0KHY0LngsIHY0LnksIHY0LnopO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW4gdGhpcyBtZXRob2QsIGl0IGFzc2lnbnMgbGF5ZXJzIGZvciBldmVyeSBtZXNoZXMgYmFzZWQgb24gbWVzaCBhbm5vdGF0aW9ucy5cclxuICAgKiBZb3UgbXVzdCBjYWxsIHRoaXMgbWV0aG9kIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlLlxyXG4gICAqXHJcbiAgICogVGhpcyBpcyBhbiBlcXVpdmFsZW50IG9mIFtWUk1GaXJzdFBlcnNvbi5TZXR1cF0oaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9Bc3NldHMvVlJNL1VuaVZSTS9TY3JpcHRzL0ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uLmNzKSBvZiB0aGUgVW5pVlJNLlxyXG4gICAqXHJcbiAgICogVGhlIGBjYW1lcmFMYXllcmAgcGFyYW1ldGVyIHNwZWNpZmllcyB3aGljaCBsYXllciB3aWxsIGJlIGFzc2lnbmVkIGZvciBgRmlyc3RQZXJzb25Pbmx5YCAvIGBUaGlyZFBlcnNvbk9ubHlgLlxyXG4gICAqIEluIFVuaVZSTSwgd2Ugc3BlY2lmaWVkIHRob3NlIGJ5IG5hbWluZyBlYWNoIGRlc2lyZWQgbGF5ZXIgYXMgYEZJUlNUUEVSU09OX09OTFlfTEFZRVJgIC8gYFRISVJEUEVSU09OX09OTFlfTEFZRVJgXHJcbiAgICogYnV0IHdlIGFyZSBnb2luZyB0byBzcGVjaWZ5IHRoZXNlIGxheWVycyBhdCBoZXJlIHNpbmNlIHdlIGFyZSB1bmFibGUgdG8gbmFtZSBsYXllcnMgaW4gVGhyZWUuanMuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gY2FtZXJhTGF5ZXIgU3BlY2lmeSB3aGljaCBsYXllciB3aWxsIGJlIGZvciBgRmlyc3RQZXJzb25Pbmx5YCAvIGBUaGlyZFBlcnNvbk9ubHlgLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzZXR1cCh7XHJcbiAgICBmaXJzdFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVIsXHJcbiAgICB0aGlyZFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVIsXHJcbiAgfSA9IHt9KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWQpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBmaXJzdFBlcnNvbk9ubHlMYXllcjtcclxuICAgIHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyID0gdGhpcmRQZXJzb25Pbmx5TGF5ZXI7XHJcblxyXG4gICAgdGhpcy5fbWVzaEFubm90YXRpb25zLmZvckVhY2goKGl0ZW0pID0+IHtcclxuICAgICAgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuRmlyc3RQZXJzb25Pbmx5KSB7XHJcbiAgICAgICAgaXRlbS5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xyXG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuVGhpcmRQZXJzb25Pbmx5KSB7XHJcbiAgICAgICAgaXRlbS5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xyXG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuQXV0bykge1xyXG4gICAgICAgIHRoaXMuX2NyZWF0ZUhlYWRsZXNzTW9kZWwoaXRlbS5wcmltaXRpdmVzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9leGNsdWRlVHJpYW5nbGVzKHRyaWFuZ2xlczogbnVtYmVyW10sIGJ3czogbnVtYmVyW11bXSwgc2tpbkluZGV4OiBudW1iZXJbXVtdLCBleGNsdWRlOiBudW1iZXJbXSk6IG51bWJlciB7XHJcbiAgICBsZXQgY291bnQgPSAwO1xyXG4gICAgaWYgKGJ3cyAhPSBudWxsICYmIGJ3cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVzLmxlbmd0aDsgaSArPSAzKSB7XHJcbiAgICAgICAgY29uc3QgYSA9IHRyaWFuZ2xlc1tpXTtcclxuICAgICAgICBjb25zdCBiID0gdHJpYW5nbGVzW2kgKyAxXTtcclxuICAgICAgICBjb25zdCBjID0gdHJpYW5nbGVzW2kgKyAyXTtcclxuICAgICAgICBjb25zdCBidzAgPSBid3NbYV07XHJcbiAgICAgICAgY29uc3Qgc2tpbjAgPSBza2luSW5kZXhbYV07XHJcblxyXG4gICAgICAgIGlmIChidzBbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMF0pKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoYncwWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzFdKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKGJ3MFsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFsyXSkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChidzBbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbM10pKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgY29uc3QgYncxID0gYndzW2JdO1xyXG4gICAgICAgIGNvbnN0IHNraW4xID0gc2tpbkluZGV4W2JdO1xyXG4gICAgICAgIGlmIChidzFbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMF0pKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoYncxWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzFdKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKGJ3MVsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVsyXSkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChidzFbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbM10pKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgY29uc3QgYncyID0gYndzW2NdO1xyXG4gICAgICAgIGNvbnN0IHNraW4yID0gc2tpbkluZGV4W2NdO1xyXG4gICAgICAgIGlmIChidzJbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMF0pKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoYncyWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzFdKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKGJ3MlsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsyXSkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChidzJbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbM10pKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYTtcclxuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBiO1xyXG4gICAgICAgIHRyaWFuZ2xlc1tjb3VudCsrXSA9IGM7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBjb3VudDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2NyZWF0ZUVyYXNlZE1lc2goc3JjOiBUSFJFRS5Ta2lubmVkTWVzaCwgZXJhc2luZ0JvbmVzSW5kZXg6IG51bWJlcltdKTogVEhSRUUuU2tpbm5lZE1lc2gge1xyXG4gICAgY29uc3QgZHN0ID0gbmV3IFRIUkVFLlNraW5uZWRNZXNoKHNyYy5nZW9tZXRyeS5jbG9uZSgpLCBzcmMubWF0ZXJpYWwpO1xyXG4gICAgZHN0Lm5hbWUgPSBgJHtzcmMubmFtZX0oZXJhc2UpYDtcclxuICAgIGRzdC5mcnVzdHVtQ3VsbGVkID0gc3JjLmZydXN0dW1DdWxsZWQ7XHJcbiAgICBkc3QubGF5ZXJzLnNldCh0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcik7XHJcblxyXG4gICAgY29uc3QgZ2VvbWV0cnkgPSBkc3QuZ2VvbWV0cnk7XHJcblxyXG4gICAgY29uc3Qgc2tpbkluZGV4QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4JykuYXJyYXk7XHJcbiAgICBjb25zdCBza2luSW5kZXggPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpbkluZGV4QXR0ci5sZW5ndGg7IGkgKz0gNCkge1xyXG4gICAgICBza2luSW5kZXgucHVzaChbc2tpbkluZGV4QXR0cltpXSwgc2tpbkluZGV4QXR0cltpICsgMV0sIHNraW5JbmRleEF0dHJbaSArIDJdLCBza2luSW5kZXhBdHRyW2kgKyAzXV0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNraW5XZWlnaHRBdHRyID0gZ2VvbWV0cnkuZ2V0QXR0cmlidXRlKCdza2luV2VpZ2h0JykuYXJyYXk7XHJcbiAgICBjb25zdCBza2luV2VpZ2h0ID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNraW5XZWlnaHRBdHRyLmxlbmd0aDsgaSArPSA0KSB7XHJcbiAgICAgIHNraW5XZWlnaHQucHVzaChbc2tpbldlaWdodEF0dHJbaV0sIHNraW5XZWlnaHRBdHRyW2kgKyAxXSwgc2tpbldlaWdodEF0dHJbaSArIDJdLCBza2luV2VpZ2h0QXR0cltpICsgM11dKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpbmRleCA9IGdlb21ldHJ5LmdldEluZGV4KCk7XHJcbiAgICBpZiAoIWluZGV4KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBnZW9tZXRyeSBkb2Vzbid0IGhhdmUgYW4gaW5kZXggYnVmZmVyXCIpO1xyXG4gICAgfVxyXG4gICAgY29uc3Qgb2xkVHJpYW5nbGVzID0gQXJyYXkuZnJvbShpbmRleC5hcnJheSk7XHJcblxyXG4gICAgY29uc3QgY291bnQgPSB0aGlzLl9leGNsdWRlVHJpYW5nbGVzKG9sZFRyaWFuZ2xlcywgc2tpbldlaWdodCwgc2tpbkluZGV4LCBlcmFzaW5nQm9uZXNJbmRleCk7XHJcbiAgICBjb25zdCBuZXdUcmlhbmdsZTogbnVtYmVyW10gPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG4gICAgICBuZXdUcmlhbmdsZVtpXSA9IG9sZFRyaWFuZ2xlc1tpXTtcclxuICAgIH1cclxuICAgIGdlb21ldHJ5LnNldEluZGV4KG5ld1RyaWFuZ2xlKTtcclxuXHJcbiAgICAvLyBtdG9vbiBtYXRlcmlhbCBpbmNsdWRlcyBvbkJlZm9yZVJlbmRlci4gdGhpcyBpcyB1bnN1cHBvcnRlZCBhdCBTa2lubmVkTWVzaCNjbG9uZVxyXG4gICAgaWYgKHNyYy5vbkJlZm9yZVJlbmRlcikge1xyXG4gICAgICBkc3Qub25CZWZvcmVSZW5kZXIgPSBzcmMub25CZWZvcmVSZW5kZXI7XHJcbiAgICB9XHJcbiAgICBkc3QuYmluZChuZXcgVEhSRUUuU2tlbGV0b24oc3JjLnNrZWxldG9uLmJvbmVzLCBzcmMuc2tlbGV0b24uYm9uZUludmVyc2VzKSwgbmV3IFRIUkVFLk1hdHJpeDQoKSk7XHJcbiAgICByZXR1cm4gZHN0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKHBhcmVudDogVEhSRUUuT2JqZWN0M0QsIG1lc2g6IFRIUkVFLlNraW5uZWRNZXNoKTogdm9pZCB7XHJcbiAgICBjb25zdCBlcmFzZUJvbmVJbmRleGVzOiBudW1iZXJbXSA9IFtdO1xyXG4gICAgbWVzaC5za2VsZXRvbi5ib25lcy5mb3JFYWNoKChib25lLCBpbmRleCkgPT4ge1xyXG4gICAgICBpZiAodGhpcy5faXNFcmFzZVRhcmdldChib25lKSkgZXJhc2VCb25lSW5kZXhlcy5wdXNoKGluZGV4KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFVubGlrZSBVbmlWUk0gd2UgZG9uJ3QgY29weSBtZXNoIGlmIG5vIGludmlzaWJsZSBib25lIHdhcyBmb3VuZFxyXG4gICAgaWYgKCFlcmFzZUJvbmVJbmRleGVzLmxlbmd0aCkge1xyXG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBtZXNoLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgY29uc3QgbmV3TWVzaCA9IHRoaXMuX2NyZWF0ZUVyYXNlZE1lc2gobWVzaCwgZXJhc2VCb25lSW5kZXhlcyk7XHJcbiAgICBwYXJlbnQuYWRkKG5ld01lc2gpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbChwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10pOiB2b2lkIHtcclxuICAgIHByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XHJcbiAgICAgIGlmIChwcmltaXRpdmUudHlwZSA9PT0gJ1NraW5uZWRNZXNoJykge1xyXG4gICAgICAgIGNvbnN0IHNraW5uZWRNZXNoID0gcHJpbWl0aXZlIGFzIFRIUkVFLlNraW5uZWRNZXNoO1xyXG4gICAgICAgIHRoaXMuX2NyZWF0ZUhlYWRsZXNzTW9kZWxGb3JTa2lubmVkTWVzaChza2lubmVkTWVzaC5wYXJlbnQhLCBza2lubmVkTWVzaCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQocHJpbWl0aXZlKSkge1xyXG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJdCBqdXN0IGNoZWNrcyB3aGV0aGVyIHRoZSBub2RlIG9yIGl0cyBwYXJlbnQgaXMgdGhlIGZpcnN0IHBlcnNvbiBib25lIG9yIG5vdC5cclxuICAgKiBAcGFyYW0gYm9uZSBUaGUgdGFyZ2V0IGJvbmVcclxuICAgKi9cclxuICBwcml2YXRlIF9pc0VyYXNlVGFyZ2V0KGJvbmU6IEdMVEZOb2RlKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYm9uZSA9PT0gdGhpcy5fZmlyc3RQZXJzb25Cb25lKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSBlbHNlIGlmICghYm9uZS5wYXJlbnQpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2lzRXJhc2VUYXJnZXQoYm9uZS5wYXJlbnQpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcclxuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZCc7XHJcbmltcG9ydCB7IEdMVEZOb2RlLCBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcclxuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24sIFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFncyB9IGZyb20gJy4vVlJNRmlyc3RQZXJzb24nO1xyXG5cclxuLyoqXHJcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBhIFtbVlJNRmlyc3RQZXJzb25dXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNRmlyc3RQZXJzb25JbXBvcnRlciB7XHJcbiAgLyoqXHJcbiAgICogSW1wb3J0IGEgW1tWUk1GaXJzdFBlcnNvbl1dIGZyb20gYSBWUk0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICAgKiBAcGFyYW0gaHVtYW5vaWQgQSBbW1ZSTUh1bWFub2lkXV0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYsIGh1bWFub2lkOiBWUk1IdW1hbm9pZCk6IFByb21pc2U8VlJNRmlyc3RQZXJzb24gfCBudWxsPiB7XHJcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcclxuICAgIGlmICghdnJtRXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjaGVtYUZpcnN0UGVyc29uOiBWUk1TY2hlbWEuRmlyc3RQZXJzb24gfCB1bmRlZmluZWQgPSB2cm1FeHQuZmlyc3RQZXJzb247XHJcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpcnN0UGVyc29uQm9uZUluZGV4ID0gc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lO1xyXG5cclxuICAgIGxldCBmaXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlIHwgbnVsbDtcclxuICAgIGlmIChmaXJzdFBlcnNvbkJvbmVJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGZpcnN0UGVyc29uQm9uZUluZGV4ID09PSAtMSkge1xyXG4gICAgICBmaXJzdFBlcnNvbkJvbmUgPSBodW1hbm9pZC5nZXRCb25lTm9kZShWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZS5IZWFkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGZpcnN0UGVyc29uQm9uZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBmaXJzdFBlcnNvbkJvbmVJbmRleCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFmaXJzdFBlcnNvbkJvbmUpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdWUk1GaXJzdFBlcnNvbkltcG9ydGVyOiBDb3VsZCBub3QgZmluZCBmaXJzdFBlcnNvbkJvbmUgb2YgdGhlIFZSTScpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaXJzdFBlcnNvbkJvbmVPZmZzZXQgPSBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXRcclxuICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMyhcclxuICAgICAgICAgIHNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZU9mZnNldC54LFxyXG4gICAgICAgICAgc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnksXHJcbiAgICAgICAgICAtc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnohLCAvLyBWUk0gMC4wIHVzZXMgbGVmdC1oYW5kZWQgeS11cFxyXG4gICAgICAgIClcclxuICAgICAgOiBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMDYsIDAuMCk7IC8vIGZhbGxiYWNrLCB0YWtlbiBmcm9tIFVuaVZSTSBpbXBsZW1lbnRhdGlvblxyXG5cclxuICAgIGNvbnN0IG1lc2hBbm5vdGF0aW9uczogVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzW10gPSBbXTtcclxuICAgIGNvbnN0IG5vZGVQcmltaXRpdmVzTWFwID0gYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGYpO1xyXG5cclxuICAgIEFycmF5LmZyb20obm9kZVByaW1pdGl2ZXNNYXAuZW50cmllcygpKS5mb3JFYWNoKChbbm9kZUluZGV4LCBwcmltaXRpdmVzXSkgPT4ge1xyXG4gICAgICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XHJcblxyXG4gICAgICBjb25zdCBmbGFnID0gc2NoZW1hRmlyc3RQZXJzb24ubWVzaEFubm90YXRpb25zXHJcbiAgICAgICAgPyBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnMuZmluZCgoYSkgPT4gYS5tZXNoID09PSBzY2hlbWFOb2RlLm1lc2gpXHJcbiAgICAgICAgOiB1bmRlZmluZWQ7XHJcbiAgICAgIG1lc2hBbm5vdGF0aW9ucy5wdXNoKG5ldyBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3MoZmxhZz8uZmlyc3RQZXJzb25GbGFnLCBwcmltaXRpdmVzKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFZSTUZpcnN0UGVyc29uKGZpcnN0UGVyc29uQm9uZSwgZmlyc3RQZXJzb25Cb25lT2Zmc2V0LCBtZXNoQW5ub3RhdGlvbnMpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgeyBHTFRGTm9kZSB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgVlJNSHVtYW5MaW1pdCB9IGZyb20gJy4vVlJNSHVtYW5MaW1pdCc7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIGBodW1hbkJvbmVgIG9mIGEgVlJNLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUh1bWFuQm9uZSB7XHJcbiAgLyoqXHJcbiAgICogQSBbW0dMVEZOb2RlXV0gKHRoYXQgYWN0dWFsbHkgaXMgYSBgVEhSRUUuT2JqZWN0M0RgKSB0aGF0IHJlcHJlc2VudHMgdGhlIGJvbmUuXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG5vZGU6IEdMVEZOb2RlO1xyXG5cclxuICAvKipcclxuICAgKiBBIFtbVlJNSHVtYW5MaW1pdF1dIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgYm9uZS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5MaW1pdDogVlJNSHVtYW5MaW1pdDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUh1bWFuQm9uZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBub2RlIEEgW1tHTFRGTm9kZV1dIHRoYXQgcmVwcmVzZW50cyB0aGUgbmV3IGJvbmVcclxuICAgKiBAcGFyYW0gaHVtYW5MaW1pdCBBIFtbVlJNSHVtYW5MaW1pdF1dIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgbmV3IGJvbmVcclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3Iobm9kZTogR0xURk5vZGUsIGh1bWFuTGltaXQ6IFZSTUh1bWFuTGltaXQpIHtcclxuICAgIHRoaXMubm9kZSA9IG5vZGU7XHJcbiAgICB0aGlzLmh1bWFuTGltaXQgPSBodW1hbkxpbWl0O1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcblxyXG4vKipcclxuICogQSBjb21wYXQgZnVuY3Rpb24gZm9yIGBRdWF0ZXJuaW9uLmludmVydCgpYCAvIGBRdWF0ZXJuaW9uLmludmVyc2UoKWAuXHJcbiAqIGBRdWF0ZXJuaW9uLmludmVydCgpYCBpcyBpbnRyb2R1Y2VkIGluIHIxMjMgYW5kIGBRdWF0ZXJuaW9uLmludmVyc2UoKWAgZW1pdHMgYSB3YXJuaW5nLlxyXG4gKiBXZSBhcmUgZ29pbmcgdG8gdXNlIHRoaXMgY29tcGF0IGZvciBhIHdoaWxlLlxyXG4gKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IHF1YXRlcm5pb25cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBxdWF0SW52ZXJ0Q29tcGF0PFQgZXh0ZW5kcyBUSFJFRS5RdWF0ZXJuaW9uPih0YXJnZXQ6IFQpOiBUIHtcclxuICBpZiAoKHRhcmdldCBhcyBhbnkpLmludmVydCkge1xyXG4gICAgdGFyZ2V0LmludmVydCgpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAodGFyZ2V0IGFzIGFueSkuaW52ZXJzZSgpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRhcmdldDtcclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEZOb2RlLCBSYXdWZWN0b3IzLCBSYXdWZWN0b3I0LCBWUk1Qb3NlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IHF1YXRJbnZlcnRDb21wYXQgfSBmcm9tICcuLi91dGlscy9xdWF0SW52ZXJ0Q29tcGF0JztcclxuaW1wb3J0IHsgVlJNSHVtYW5Cb25lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmUnO1xyXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVBcnJheSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lQXJyYXknO1xyXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVzIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVzJztcclxuaW1wb3J0IHsgVlJNSHVtYW5EZXNjcmlwdGlvbiB9IGZyb20gJy4vVlJNSHVtYW5EZXNjcmlwdGlvbic7XHJcblxyXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuXHJcbi8qKlxyXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgaHVtYW5vaWQgb2YgYSBWUk0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWQge1xyXG4gIC8qKlxyXG4gICAqIEEgW1tWUk1IdW1hbkJvbmVzXV0gdGhhdCBjb250YWlucyBhbGwgdGhlIGh1bWFuIGJvbmVzIG9mIHRoZSBWUk0uXHJcbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gZ2V0IHRoZXNlIGJvbmVzIHVzaW5nIFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZV1dLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkJvbmVzOiBWUk1IdW1hbkJvbmVzO1xyXG5cclxuICAvKipcclxuICAgKiBBIFtbVlJNSHVtYW5EZXNjcmlwdGlvbl1dIHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBodW1hbm9pZC5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5EZXNjcmlwdGlvbjogVlJNSHVtYW5EZXNjcmlwdGlvbjtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBbW1ZSTVBvc2VdXSB0aGF0IGlzIGl0cyBkZWZhdWx0IHN0YXRlLlxyXG4gICAqIE5vdGUgdGhhdCBpdCdzIG5vdCBjb21wYXRpYmxlIHdpdGggYHNldFBvc2VgIGFuZCBgZ2V0UG9zZWAsIHNpbmNlIGl0IGNvbnRhaW5zIG5vbi1yZWxhdGl2ZSB2YWx1ZXMgb2YgZWFjaCBsb2NhbCB0cmFuc2Zvcm1zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSByZXN0UG9zZTogVlJNUG9zZSA9IHt9O1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgW1tWUk1IdW1hbm9pZF1dLlxyXG4gICAqIEBwYXJhbSBib25lQXJyYXkgQSBbW1ZSTUh1bWFuQm9uZUFycmF5XV0gY29udGFpbnMgYWxsIHRoZSBib25lcyBvZiB0aGUgbmV3IGh1bWFub2lkXHJcbiAgICogQHBhcmFtIGh1bWFuRGVzY3JpcHRpb24gQSBbW1ZSTUh1bWFuRGVzY3JpcHRpb25dXSB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgbmV3IGh1bWFub2lkXHJcbiAgICovXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKGJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXksIGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb24pIHtcclxuICAgIHRoaXMuaHVtYW5Cb25lcyA9IHRoaXMuX2NyZWF0ZUh1bWFuQm9uZXMoYm9uZUFycmF5KTtcclxuICAgIHRoaXMuaHVtYW5EZXNjcmlwdGlvbiA9IGh1bWFuRGVzY3JpcHRpb247XHJcblxyXG4gICAgdGhpcy5yZXN0UG9zZSA9IHRoaXMuZ2V0UG9zZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIHRoZSBjdXJyZW50IHBvc2Ugb2YgdGhpcyBodW1hbm9pZCBhcyBhIFtbVlJNUG9zZV1dLlxyXG4gICAqXHJcbiAgICogRWFjaCB0cmFuc2Zvcm0gaXMgYSBsb2NhbCB0cmFuc2Zvcm0gcmVsYXRpdmUgZnJvbSByZXN0IHBvc2UgKFQtcG9zZSkuXHJcbiAgICovXHJcbiAgcHVibGljIGdldFBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICBjb25zdCBwb3NlOiBWUk1Qb3NlID0ge307XHJcbiAgICBPYmplY3Qua2V5cyh0aGlzLmh1bWFuQm9uZXMpLmZvckVhY2goKHZybUJvbmVOYW1lKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKHZybUJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKSE7XHJcblxyXG4gICAgICAvLyBJZ25vcmUgd2hlbiB0aGVyZSBhcmUgbm8gYm9uZSBvbiB0aGUgVlJNSHVtYW5vaWRcclxuICAgICAgaWYgKCFub2RlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBXaGVuIHRoZXJlIGFyZSB0d28gb3IgbW9yZSBib25lcyBpbiBhIHNhbWUgbmFtZSwgd2UgYXJlIG5vdCBnb2luZyB0byBvdmVyd3JpdGUgZXhpc3Rpbmcgb25lXHJcbiAgICAgIGlmIChwb3NlW3ZybUJvbmVOYW1lXSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gVGFrZSBhIGRpZmYgZnJvbSByZXN0UG9zZVxyXG4gICAgICAvLyBub3RlIHRoYXQgcmVzdFBvc2UgYWxzbyB3aWxsIHVzZSBnZXRQb3NlIHRvIGluaXRpYWxpemUgaXRzZWxmXHJcbiAgICAgIF92M0Euc2V0KDAsIDAsIDApO1xyXG4gICAgICBfcXVhdEEuaWRlbnRpdHkoKTtcclxuXHJcbiAgICAgIGNvbnN0IHJlc3RTdGF0ZSA9IHRoaXMucmVzdFBvc2VbdnJtQm9uZU5hbWVdO1xyXG4gICAgICBpZiAocmVzdFN0YXRlPy5wb3NpdGlvbikge1xyXG4gICAgICAgIF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikubmVnYXRlKCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHJlc3RTdGF0ZT8ucm90YXRpb24pIHtcclxuICAgICAgICBxdWF0SW52ZXJ0Q29tcGF0KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEdldCB0aGUgcG9zaXRpb24gLyByb3RhdGlvbiBmcm9tIHRoZSBub2RlXHJcbiAgICAgIF92M0EuYWRkKG5vZGUucG9zaXRpb24pO1xyXG4gICAgICBfcXVhdEEucHJlbXVsdGlwbHkobm9kZS5xdWF0ZXJuaW9uKTtcclxuXHJcbiAgICAgIHBvc2VbdnJtQm9uZU5hbWVdID0ge1xyXG4gICAgICAgIHBvc2l0aW9uOiBfdjNBLnRvQXJyYXkoKSBhcyBSYXdWZWN0b3IzLFxyXG4gICAgICAgIHJvdGF0aW9uOiBfcXVhdEEudG9BcnJheSgpIGFzIFJhd1ZlY3RvcjQsXHJcbiAgICAgIH07XHJcbiAgICB9LCB7fSBhcyBWUk1Qb3NlKTtcclxuICAgIHJldHVybiBwb3NlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTGV0IHRoZSBodW1hbm9pZCBkbyBhIHNwZWNpZmllZCBwb3NlLlxyXG4gICAqXHJcbiAgICogRWFjaCB0cmFuc2Zvcm0gaGF2ZSB0byBiZSBhIGxvY2FsIHRyYW5zZm9ybSByZWxhdGl2ZSBmcm9tIHJlc3QgcG9zZSAoVC1wb3NlKS5cclxuICAgKiBZb3UgY2FuIHBhc3Mgd2hhdCB5b3UgZ290IGZyb20ge0BsaW5rIGdldFBvc2V9LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHBvc2VPYmplY3QgQSBbW1ZSTVBvc2VdXSB0aGF0IHJlcHJlc2VudHMgYSBzaW5nbGUgcG9zZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBzZXRQb3NlKHBvc2VPYmplY3Q6IFZSTVBvc2UpOiB2b2lkIHtcclxuICAgIE9iamVjdC5rZXlzKHBvc2VPYmplY3QpLmZvckVhY2goKGJvbmVOYW1lKSA9PiB7XHJcbiAgICAgIGNvbnN0IHN0YXRlID0gcG9zZU9iamVjdFtib25lTmFtZV0hO1xyXG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXRCb25lTm9kZShib25lTmFtZSBhcyBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk7XHJcblxyXG4gICAgICAvLyBJZ25vcmUgd2hlbiB0aGVyZSBhcmUgbm8gYm9uZSB0aGF0IGlzIGRlZmluZWQgaW4gdGhlIHBvc2Ugb24gdGhlIFZSTUh1bWFub2lkXHJcbiAgICAgIGlmICghbm9kZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgcmVzdFN0YXRlID0gdGhpcy5yZXN0UG9zZVtib25lTmFtZV07XHJcbiAgICAgIGlmICghcmVzdFN0YXRlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoc3RhdGUucG9zaXRpb24pIHtcclxuICAgICAgICBub2RlLnBvc2l0aW9uLmZyb21BcnJheShzdGF0ZS5wb3NpdGlvbik7XHJcblxyXG4gICAgICAgIGlmIChyZXN0U3RhdGUucG9zaXRpb24pIHtcclxuICAgICAgICAgIG5vZGUucG9zaXRpb24uYWRkKF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHN0YXRlLnJvdGF0aW9uKSB7XHJcbiAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLmZyb21BcnJheShzdGF0ZS5yb3RhdGlvbik7XHJcblxyXG4gICAgICAgIGlmIChyZXN0U3RhdGUucm90YXRpb24pIHtcclxuICAgICAgICAgIG5vZGUucXVhdGVybmlvbi5tdWx0aXBseShfcXVhdEEuZnJvbUFycmF5KHJlc3RTdGF0ZS5yb3RhdGlvbikpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNldCB0aGUgaHVtYW5vaWQgdG8gaXRzIHJlc3QgcG9zZS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVzZXRQb3NlKCk6IHZvaWQge1xyXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5yZXN0UG9zZSkuZm9yRWFjaCgoW2JvbmVOYW1lLCByZXN0XSkgPT4ge1xyXG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXRCb25lTm9kZShib25lTmFtZSBhcyBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk7XHJcblxyXG4gICAgICBpZiAoIW5vZGUpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChyZXN0Py5wb3NpdGlvbikge1xyXG4gICAgICAgIG5vZGUucG9zaXRpb24uZnJvbUFycmF5KHJlc3QucG9zaXRpb24pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAocmVzdD8ucm90YXRpb24pIHtcclxuICAgICAgICBub2RlLnF1YXRlcm5pb24uZnJvbUFycmF5KHJlc3Qucm90YXRpb24pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiBhIGJvbmUgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYSBbW1ZSTUh1bWFuQm9uZV1dLlxyXG4gICAqXHJcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZXNdXVxyXG4gICAqXHJcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYm9uZSB5b3Ugd2FudFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRCb25lKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogVlJNSHVtYW5Cb25lIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmh1bWFuQm9uZXNbbmFtZV1bMF0gPz8gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIGJvbmVzIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGFuIGFycmF5IG9mIFtbVlJNSHVtYW5Cb25lXV0uXHJcbiAgICogSWYgdGhlcmUgYXJlIG5vIGJvbmVzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgSHVtYW5Cb25lLCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cclxuICAgKlxyXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUh1bWFub2lkLmdldEJvbmVdXVxyXG4gICAqXHJcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYm9uZSB5b3Ugd2FudFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRCb25lcyhuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IFZSTUh1bWFuQm9uZVtdIHtcclxuICAgIHJldHVybiB0aGlzLmh1bWFuQm9uZXNbbmFtZV0gPz8gW107XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm4gYSBib25lIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGEgVEhSRUUuT2JqZWN0M0QuXHJcbiAgICpcclxuICAgKiBTZWUgYWxzbzogW1tWUk1IdW1hbm9pZC5nZXRCb25lTm9kZXNdXVxyXG4gICAqXHJcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYm9uZSB5b3Ugd2FudFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRCb25lTm9kZShuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IEdMVEZOb2RlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdWzBdPy5ub2RlID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm4gYm9uZXMgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYW4gYXJyYXkgb2YgVEhSRUUuT2JqZWN0M0QuXHJcbiAgICogSWYgdGhlcmUgYXJlIG5vIGJvbmVzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgSHVtYW5Cb25lLCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cclxuICAgKlxyXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUh1bWFub2lkLmdldEJvbmVOb2RlXV1cclxuICAgKlxyXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0Qm9uZU5vZGVzKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogR0xURk5vZGVbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdPy5tYXAoKGJvbmUpID0+IGJvbmUubm9kZSkgPz8gW107XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQcmVwYXJlIGEgW1tWUk1IdW1hbkJvbmVzXV0gZnJvbSBhIFtbVlJNSHVtYW5Cb25lQXJyYXldXS5cclxuICAgKi9cclxuICBwcml2YXRlIF9jcmVhdGVIdW1hbkJvbmVzKGJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXkpOiBWUk1IdW1hbkJvbmVzIHtcclxuICAgIGNvbnN0IGJvbmVzOiBWUk1IdW1hbkJvbmVzID0gT2JqZWN0LnZhbHVlcyhWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSkucmVkdWNlKChhY2N1bSwgbmFtZSkgPT4ge1xyXG4gICAgICBhY2N1bVtuYW1lXSA9IFtdO1xyXG4gICAgICByZXR1cm4gYWNjdW07XHJcbiAgICB9LCB7fSBhcyBQYXJ0aWFsPFZSTUh1bWFuQm9uZXM+KSBhcyBWUk1IdW1hbkJvbmVzO1xyXG5cclxuICAgIGJvbmVBcnJheS5mb3JFYWNoKChib25lKSA9PiB7XHJcbiAgICAgIGJvbmVzW2JvbmUubmFtZV0ucHVzaChib25lLmJvbmUpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGJvbmVzO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcclxuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmUgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZSc7XHJcbmltcG9ydCB7IFZSTUh1bWFuQm9uZUFycmF5IH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVBcnJheSc7XHJcbmltcG9ydCB7IFZSTUh1bWFuRGVzY3JpcHRpb24gfSBmcm9tICcuL1ZSTUh1bWFuRGVzY3JpcHRpb24nO1xyXG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4vVlJNSHVtYW5vaWQnO1xyXG5cclxuLyoqXHJcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBhIFtbVlJNSHVtYW5vaWRdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWRJbXBvcnRlciB7XHJcbiAgLyoqXHJcbiAgICogSW1wb3J0IGEgW1tWUk1IdW1hbm9pZF1dIGZyb20gYSBWUk0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTUh1bWFub2lkIHwgbnVsbD4ge1xyXG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XHJcbiAgICBpZiAoIXZybUV4dCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzY2hlbWFIdW1hbm9pZDogVlJNU2NoZW1hLkh1bWFub2lkIHwgdW5kZWZpbmVkID0gdnJtRXh0Lmh1bWFub2lkO1xyXG4gICAgaWYgKCFzY2hlbWFIdW1hbm9pZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBodW1hbkJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXkgPSBbXTtcclxuICAgIGlmIChzY2hlbWFIdW1hbm9pZC5odW1hbkJvbmVzKSB7XHJcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxyXG4gICAgICAgIHNjaGVtYUh1bWFub2lkLmh1bWFuQm9uZXMubWFwKGFzeW5jIChib25lKSA9PiB7XHJcbiAgICAgICAgICBpZiAoIWJvbmUuYm9uZSB8fCBib25lLm5vZGUgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgY29uc3Qgbm9kZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBib25lLm5vZGUpO1xyXG4gICAgICAgICAgaHVtYW5Cb25lQXJyYXkucHVzaCh7XHJcbiAgICAgICAgICAgIG5hbWU6IGJvbmUuYm9uZSxcclxuICAgICAgICAgICAgYm9uZTogbmV3IFZSTUh1bWFuQm9uZShub2RlLCB7XHJcbiAgICAgICAgICAgICAgYXhpc0xlbmd0aDogYm9uZS5heGlzTGVuZ3RoLFxyXG4gICAgICAgICAgICAgIGNlbnRlcjogYm9uZS5jZW50ZXIgJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5jZW50ZXIueCwgYm9uZS5jZW50ZXIueSwgYm9uZS5jZW50ZXIueiksXHJcbiAgICAgICAgICAgICAgbWF4OiBib25lLm1heCAmJiBuZXcgVEhSRUUuVmVjdG9yMyhib25lLm1heC54LCBib25lLm1heC55LCBib25lLm1heC56KSxcclxuICAgICAgICAgICAgICBtaW46IGJvbmUubWluICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUubWluLngsIGJvbmUubWluLnksIGJvbmUubWluLnopLFxyXG4gICAgICAgICAgICAgIHVzZURlZmF1bHRWYWx1ZXM6IGJvbmUudXNlRGVmYXVsdFZhbHVlcyxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBodW1hbkRlc2NyaXB0aW9uOiBWUk1IdW1hbkRlc2NyaXB0aW9uID0ge1xyXG4gICAgICBhcm1TdHJldGNoOiBzY2hlbWFIdW1hbm9pZC5hcm1TdHJldGNoLFxyXG4gICAgICBsZWdTdHJldGNoOiBzY2hlbWFIdW1hbm9pZC5sZWdTdHJldGNoLFxyXG4gICAgICB1cHBlckFybVR3aXN0OiBzY2hlbWFIdW1hbm9pZC51cHBlckFybVR3aXN0LFxyXG4gICAgICBsb3dlckFybVR3aXN0OiBzY2hlbWFIdW1hbm9pZC5sb3dlckFybVR3aXN0LFxyXG4gICAgICB1cHBlckxlZ1R3aXN0OiBzY2hlbWFIdW1hbm9pZC51cHBlckxlZ1R3aXN0LFxyXG4gICAgICBsb3dlckxlZ1R3aXN0OiBzY2hlbWFIdW1hbm9pZC5sb3dlckxlZ1R3aXN0LFxyXG4gICAgICBmZWV0U3BhY2luZzogc2NoZW1hSHVtYW5vaWQuZmVldFNwYWNpbmcsXHJcbiAgICAgIGhhc1RyYW5zbGF0aW9uRG9GOiBzY2hlbWFIdW1hbm9pZC5oYXNUcmFuc2xhdGlvbkRvRixcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBWUk1IdW1hbm9pZChodW1hbkJvbmVBcnJheSwgaHVtYW5EZXNjcmlwdGlvbik7XHJcbiAgfVxyXG59XHJcbiIsIi8qKlxyXG4gKiBFdmFsdWF0ZSBhIGhlcm1pdGUgc3BsaW5lLlxyXG4gKlxyXG4gKiBAcGFyYW0geTAgeSBvbiBzdGFydFxyXG4gKiBAcGFyYW0geTEgeSBvbiBlbmRcclxuICogQHBhcmFtIHQwIGRlbHRhIHkgb24gc3RhcnRcclxuICogQHBhcmFtIHQxIGRlbHRhIHkgb24gZW5kXHJcbiAqIEBwYXJhbSB4IGlucHV0IHZhbHVlXHJcbiAqL1xyXG5jb25zdCBoZXJtaXRlU3BsaW5lID0gKHkwOiBudW1iZXIsIHkxOiBudW1iZXIsIHQwOiBudW1iZXIsIHQxOiBudW1iZXIsIHg6IG51bWJlcik6IG51bWJlciA9PiB7XHJcbiAgY29uc3QgeGMgPSB4ICogeCAqIHg7XHJcbiAgY29uc3QgeHMgPSB4ICogeDtcclxuICBjb25zdCBkeSA9IHkxIC0geTA7XHJcbiAgY29uc3QgaDAxID0gLTIuMCAqIHhjICsgMy4wICogeHM7XHJcbiAgY29uc3QgaDEwID0geGMgLSAyLjAgKiB4cyArIHg7XHJcbiAgY29uc3QgaDExID0geGMgLSB4cztcclxuICByZXR1cm4geTAgKyBkeSAqIGgwMSArIHQwICogaDEwICsgdDEgKiBoMTE7XHJcbn07XHJcblxyXG4vKipcclxuICogRXZhbHVhdGUgYW4gQW5pbWF0aW9uQ3VydmUgYXJyYXkuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXHJcbiAqXHJcbiAqIFNlZTogaHR0cHM6Ly9kb2NzLnVuaXR5M2QuY29tL2phL2N1cnJlbnQvU2NyaXB0UmVmZXJlbmNlL0FuaW1hdGlvbkN1cnZlLmh0bWxcclxuICpcclxuICogQHBhcmFtIGFyciBBbiBhcnJheSByZXByZXNlbnRzIGEgY3VydmVcclxuICogQHBhcmFtIHggQW4gaW5wdXQgdmFsdWVcclxuICovXHJcbmNvbnN0IGV2YWx1YXRlQ3VydmUgPSAoYXJyOiBudW1iZXJbXSwgeDogbnVtYmVyKTogbnVtYmVyID0+IHtcclxuICAvLyAtLSBzYW5pdHkgY2hlY2sgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICBpZiAoYXJyLmxlbmd0aCA8IDgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignZXZhbHVhdGVDdXJ2ZTogSW52YWxpZCBjdXJ2ZSBkZXRlY3RlZCEgKEFycmF5IGxlbmd0aCBtdXN0IGJlIDggYXQgbGVhc3QpJyk7XHJcbiAgfVxyXG4gIGlmIChhcnIubGVuZ3RoICUgNCAhPT0gMCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdldmFsdWF0ZUN1cnZlOiBJbnZhbGlkIGN1cnZlIGRldGVjdGVkISAoQXJyYXkgbGVuZ3RoIG11c3QgYmUgbXVsdGlwbGVzIG9mIDQnKTtcclxuICB9XHJcblxyXG4gIC8vIC0tIGNoZWNrIHJhbmdlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gIGxldCBvdXROb2RlO1xyXG4gIGZvciAob3V0Tm9kZSA9IDA7IDsgb3V0Tm9kZSsrKSB7XHJcbiAgICBpZiAoYXJyLmxlbmd0aCA8PSA0ICogb3V0Tm9kZSkge1xyXG4gICAgICByZXR1cm4gYXJyWzQgKiBvdXROb2RlIC0gM107IC8vIHRvbyBmdXJ0aGVyISEgYXNzdW1lIGFzIFwiQ2xhbXBcIlxyXG4gICAgfSBlbHNlIGlmICh4IDw9IGFycls0ICogb3V0Tm9kZV0pIHtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCBpbk5vZGUgPSBvdXROb2RlIC0gMTtcclxuICBpZiAoaW5Ob2RlIDwgMCkge1xyXG4gICAgcmV0dXJuIGFycls0ICogaW5Ob2RlICsgNV07IC8vIHRvbyBiZWhpbmQhISBhc3N1bWUgYXMgXCJDbGFtcFwiXHJcbiAgfVxyXG5cclxuICAvLyAtLSBjYWxjdWxhdGUgbG9jYWwgeCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICBjb25zdCB4MCA9IGFycls0ICogaW5Ob2RlXTtcclxuICBjb25zdCB4MSA9IGFycls0ICogb3V0Tm9kZV07XHJcbiAgY29uc3QgeEhlcm1pdGUgPSAoeCAtIHgwKSAvICh4MSAtIHgwKTtcclxuXHJcbiAgLy8gLS0gZmluYWxseSBkbyB0aGUgaGVybWl0ZSBzcGxpbmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgY29uc3QgeTAgPSBhcnJbNCAqIGluTm9kZSArIDFdO1xyXG4gIGNvbnN0IHkxID0gYXJyWzQgKiBvdXROb2RlICsgMV07XHJcbiAgY29uc3QgdDAgPSBhcnJbNCAqIGluTm9kZSArIDNdO1xyXG4gIGNvbnN0IHQxID0gYXJyWzQgKiBvdXROb2RlICsgMl07XHJcbiAgcmV0dXJuIGhlcm1pdGVTcGxpbmUoeTAsIHkxLCB0MCwgdDEsIHhIZXJtaXRlKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGlzIGFuIGVxdWl2YWxlbnQgb2YgQ3VydmVNYXBwZXIgY2xhc3MgZGVmaW5lZCBpbiBVbmlWUk0uXHJcbiAqIFdpbGwgYmUgdXNlZCBmb3IgW1tWUk1Mb29rQXRBcHBseWVyXV1zLCB0byBkZWZpbmUgYmVoYXZpb3Igb2YgTG9va0F0LlxyXG4gKlxyXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9Mb29rQXQvQ3VydmVNYXBwZXIuY3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1DdXJ2ZU1hcHBlciB7XHJcbiAgLyoqXHJcbiAgICogQW4gYXJyYXkgcmVwcmVzZW50cyB0aGUgY3VydmUuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXHJcbiAgICpcclxuICAgKiBTZWU6IGh0dHBzOi8vZG9jcy51bml0eTNkLmNvbS9qYS9jdXJyZW50L1NjcmlwdFJlZmVyZW5jZS9BbmltYXRpb25DdXJ2ZS5odG1sXHJcbiAgICovXHJcbiAgcHVibGljIGN1cnZlOiBudW1iZXJbXSA9IFswLjAsIDAuMCwgMC4wLCAxLjAsIDEuMCwgMS4wLCAxLjAsIDAuMF07XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBtYXhpbXVtIGlucHV0IHJhbmdlIG9mIHRoZSBbW1ZSTUN1cnZlTWFwcGVyXV0uXHJcbiAgICovXHJcbiAgcHVibGljIGN1cnZlWFJhbmdlRGVncmVlID0gOTAuMDtcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIG1heGltdW0gb3V0cHV0IHZhbHVlIG9mIHRoZSBbW1ZSTUN1cnZlTWFwcGVyXV0uXHJcbiAgICovXHJcbiAgcHVibGljIGN1cnZlWVJhbmdlRGVncmVlID0gMTAuMDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNQ3VydmVNYXBwZXJdXS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB4UmFuZ2UgVGhlIG1heGltdW0gaW5wdXQgcmFuZ2VcclxuICAgKiBAcGFyYW0geVJhbmdlIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZVxyXG4gICAqIEBwYXJhbSBjdXJ2ZSBBbiBhcnJheSByZXByZXNlbnRzIHRoZSBjdXJ2ZVxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKHhSYW5nZT86IG51bWJlciwgeVJhbmdlPzogbnVtYmVyLCBjdXJ2ZT86IG51bWJlcltdKSB7XHJcbiAgICBpZiAoeFJhbmdlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5jdXJ2ZVhSYW5nZURlZ3JlZSA9IHhSYW5nZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoeVJhbmdlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5jdXJ2ZVlSYW5nZURlZ3JlZSA9IHlSYW5nZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoY3VydmUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLmN1cnZlID0gY3VydmU7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFdmFsdWF0ZSBhbiBpbnB1dCB2YWx1ZSBhbmQgb3V0cHV0IGEgbWFwcGVkIHZhbHVlLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHNyYyBUaGUgaW5wdXQgdmFsdWVcclxuICAgKi9cclxuICBwdWJsaWMgbWFwKHNyYzogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IGNsYW1wZWRTcmMgPSBNYXRoLm1pbihNYXRoLm1heChzcmMsIDAuMCksIHRoaXMuY3VydmVYUmFuZ2VEZWdyZWUpO1xyXG4gICAgY29uc3QgeCA9IGNsYW1wZWRTcmMgLyB0aGlzLmN1cnZlWFJhbmdlRGVncmVlO1xyXG4gICAgcmV0dXJuIHRoaXMuY3VydmVZUmFuZ2VEZWdyZWUgKiBldmFsdWF0ZUN1cnZlKHRoaXMuY3VydmUsIHgpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGNsYXNzIGlzIHVzZWQgYnkgW1tWUk1Mb29rQXRIZWFkXV0sIGFwcGxpZXMgbG9vayBhdCBkaXJlY3Rpb24uXHJcbiAqIFRoZXJlIGFyZSBjdXJyZW50bHkgdHdvIHZhcmlhbnQgb2YgYXBwbGllcjogW1tWUk1Mb29rQXRCb25lQXBwbHllcl1dIGFuZCBbW1ZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyXV0uXHJcbiAqL1xyXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVlJNTG9va0F0QXBwbHllciB7XHJcbiAgLyoqXHJcbiAgICogSXQgcmVwcmVzZW50cyBpdHMgdHlwZSBvZiBhcHBsaWVyLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSB0eXBlOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZTtcclxuXHJcbiAgLyoqXHJcbiAgICogQXBwbHkgbG9vayBhdCBkaXJlY3Rpb24gdG8gaXRzIGFzc29jaWF0ZWQgVlJNIG1vZGVsLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGV1bGVyIGBUSFJFRS5FdWxlcmAgb2JqZWN0IHRoYXQgcmVwcmVzZW50cyB0aGUgbG9vayBhdCBkaXJlY3Rpb25cclxuICAgKi9cclxuICBwdWJsaWMgYWJzdHJhY3QgbG9va0F0KGV1bGVyOiBUSFJFRS5FdWxlcik6IHZvaWQ7XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcclxuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGNsYXNzIGlzIHVzZWQgYnkgW1tWUk1Mb29rQXRIZWFkXV0sIGFwcGxpZXMgbG9vayBhdCBkaXJlY3Rpb24gdG8gZXllIGJsZW5kIHNoYXBlcyBvZiBhIFZSTS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllciBleHRlbmRzIFZSTUxvb2tBdEFwcGx5ZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQmxlbmRTaGFwZTtcclxuXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVIb3Jpem9udGFsOiBWUk1DdXJ2ZU1hcHBlcjtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXI7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbFVwOiBWUk1DdXJ2ZU1hcHBlcjtcclxuXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZVByb3h5OiBWUk1CbGVuZFNoYXBlUHJveHk7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllci5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBibGVuZFNoYXBlUHJveHkgQSBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIHVzZWQgYnkgdGhpcyBhcHBsaWVyXHJcbiAgICogQHBhcmFtIGN1cnZlSG9yaXpvbnRhbCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsRG93biBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBkb3duIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsVXAgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdXAgZGlyZWN0aW9uXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcclxuICAgIGN1cnZlSG9yaXpvbnRhbDogVlJNQ3VydmVNYXBwZXIsXHJcbiAgICBjdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXIsXHJcbiAgICBjdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyLFxyXG4gICkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLl9jdXJ2ZUhvcml6b250YWwgPSBjdXJ2ZUhvcml6b250YWw7XHJcbiAgICB0aGlzLl9jdXJ2ZVZlcnRpY2FsRG93biA9IGN1cnZlVmVydGljYWxEb3duO1xyXG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbFVwID0gY3VydmVWZXJ0aWNhbFVwO1xyXG5cclxuICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eSA9IGJsZW5kU2hhcGVQcm94eTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBuYW1lKCk6IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lIHtcclxuICAgIHJldHVybiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZS5CbGVuZFNoYXBlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IHNyY1ggPSBldWxlci54O1xyXG4gICAgY29uc3Qgc3JjWSA9IGV1bGVyLnk7XHJcblxyXG4gICAgaWYgKHNyY1ggPCAwLjApIHtcclxuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rdXAsIDAuMCk7XHJcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2Rvd24sIHRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rZG93biwgMC4wKTtcclxuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rdXAsIHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChzcmNZIDwgMC4wKSB7XHJcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2xlZnQsIDAuMCk7XHJcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va3JpZ2h0LCB0aGlzLl9jdXJ2ZUhvcml6b250YWwubWFwKC1zcmNZKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tyaWdodCwgMC4wKTtcclxuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rbGVmdCwgdGhpcy5fY3VydmVIb3Jpem9udGFsLm1hcChzcmNZKSk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbi9WUk1GaXJzdFBlcnNvbic7XHJcbmltcG9ydCB7IGdldFdvcmxkUXVhdGVybmlvbkxpdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcclxuaW1wb3J0IHsgcXVhdEludmVydENvbXBhdCB9IGZyb20gJy4uL3V0aWxzL3F1YXRJbnZlcnRDb21wYXQnO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcclxuXHJcbmNvbnN0IFZFQ1RPUjNfRlJPTlQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAtMS4wKSk7XHJcblxyXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3YzQiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfcXVhdCA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyByZXByZXNlbnRzIGxvb2sgYXQgb2YgYSBWUk0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SGVhZCB7XHJcbiAgcHVibGljIHN0YXRpYyByZWFkb25seSBFVUxFUl9PUkRFUiA9ICdZWFonOyAvLyB5YXctcGl0Y2gtcm9sbFxyXG5cclxuICAvKipcclxuICAgKiBBc3NvY2lhdGVkIFtbVlJNRmlyc3RQZXJzb25dXSwgd2lsbCBiZSB1c2VkIGZvciBkaXJlY3Rpb24gY2FsY3VsYXRpb24uXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbjtcclxuXHJcbiAgLyoqXHJcbiAgICogQXNzb2NpYXRlZCBbW1ZSTUxvb2tBdEFwcGx5ZXJdXSwgaXRzIGxvb2sgYXQgZGlyZWN0aW9uIHdpbGwgYmUgYXBwbGllZCB0byB0aGUgbW9kZWwgdXNpbmcgdGhpcyBhcHBsaWVyLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBhcHBseWVyPzogVlJNTG9va0F0QXBwbHllcjtcclxuXHJcbiAgLyoqXHJcbiAgICogSWYgdGhpcyBpcyB0cnVlLCBpdHMgbG9vayBhdCBkaXJlY3Rpb24gd2lsbCBiZSB1cGRhdGVkIGF1dG9tYXRpY2FsbHkgYnkgY2FsbGluZyBbW1ZSTUxvb2tBdEhlYWQudXBkYXRlXV0gKHdoaWNoIGlzIGNhbGxlZCBmcm9tIFtbVlJNLnVwZGF0ZV1dKS5cclxuICAgKlxyXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUxvb2tBdEhlYWQudGFyZ2V0XV1cclxuICAgKi9cclxuICBwdWJsaWMgYXV0b1VwZGF0ZSA9IHRydWU7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB0YXJnZXQgb2JqZWN0IG9mIHRoZSBsb29rIGF0LlxyXG4gICAqIE5vdGUgdGhhdCBpdCBkb2VzIG5vdCBtYWtlIGFueSBzZW5zZSBpZiBbW1ZSTUxvb2tBdEhlYWQuYXV0b1VwZGF0ZV1dIGlzIGRpc2FibGVkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyB0YXJnZXQ/OiBUSFJFRS5PYmplY3QzRDtcclxuXHJcbiAgcHJvdGVjdGVkIF9ldWxlcjogVEhSRUUuRXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoMC4wLCAwLjAsIDAuMCwgVlJNTG9va0F0SGVhZC5FVUxFUl9PUkRFUik7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRIZWFkLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGZpcnN0UGVyc29uIEEgW1tWUk1GaXJzdFBlcnNvbl1dIHRoYXQgd2lsbCBiZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBuZXcgVlJNTG9va0F0SGVhZFxyXG4gICAqIEBwYXJhbSBhcHBseWVyIEEgW1tWUk1Mb29rQXRBcHBseWVyXV0gdGhhdCB3aWxsIGJlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG5ldyBWUk1Mb29rQXRIZWFkXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZmlyc3RQZXJzb246IFZSTUZpcnN0UGVyc29uLCBhcHBseWVyPzogVlJNTG9va0F0QXBwbHllcikge1xyXG4gICAgdGhpcy5maXJzdFBlcnNvbiA9IGZpcnN0UGVyc29uO1xyXG4gICAgdGhpcy5hcHBseWVyID0gYXBwbHllcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBpdHMgbG9vayBhdCBkaXJlY3Rpb24gaW4gd29ybGQgY29vcmRpbmF0ZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgYFRIUkVFLlZlY3RvcjNgXHJcbiAgICovXHJcbiAgcHVibGljIGdldExvb2tBdFdvcmxkRGlyZWN0aW9uKHRhcmdldDogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xyXG4gICAgY29uc3Qgcm90ID0gZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZSwgX3F1YXQpO1xyXG4gICAgcmV0dXJuIHRhcmdldC5jb3B5KFZFQ1RPUjNfRlJPTlQpLmFwcGx5RXVsZXIodGhpcy5fZXVsZXIpLmFwcGx5UXVhdGVybmlvbihyb3QpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IGl0cyBsb29rIGF0IHBvc2l0aW9uLlxyXG4gICAqIE5vdGUgdGhhdCBpdHMgcmVzdWx0IHdpbGwgYmUgaW5zdGFudGx5IG92ZXJ3cml0dGVuIGlmIFtbVlJNTG9va0F0SGVhZC5hdXRvVXBkYXRlXV0gaXMgZW5hYmxlZC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBwb3NpdGlvbiBBIHRhcmdldCBwb3NpdGlvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBsb29rQXQocG9zaXRpb246IFRIUkVFLlZlY3RvcjMpOiB2b2lkIHtcclxuICAgIHRoaXMuX2NhbGNFdWxlcih0aGlzLl9ldWxlciwgcG9zaXRpb24pO1xyXG5cclxuICAgIGlmICh0aGlzLmFwcGx5ZXIpIHtcclxuICAgICAgdGhpcy5hcHBseWVyLmxvb2tBdCh0aGlzLl9ldWxlcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIFZSTUxvb2tBdEhlYWQuXHJcbiAgICogSWYgW1tWUk1Mb29rQXRIZWFkLmF1dG9VcGRhdGVdXSBpcyBkaXNhYmxlZCwgaXQgd2lsbCBkbyBub3RoaW5nLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxyXG4gICAqL1xyXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMudGFyZ2V0ICYmIHRoaXMuYXV0b1VwZGF0ZSkge1xyXG4gICAgICB0aGlzLmxvb2tBdCh0aGlzLnRhcmdldC5nZXRXb3JsZFBvc2l0aW9uKF92M0EpKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLmFwcGx5ZXIpIHtcclxuICAgICAgICB0aGlzLmFwcGx5ZXIubG9va0F0KHRoaXMuX2V1bGVyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJvdGVjdGVkIF9jYWxjRXVsZXIodGFyZ2V0OiBUSFJFRS5FdWxlciwgcG9zaXRpb246IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5FdWxlciB7XHJcbiAgICBjb25zdCBoZWFkUG9zaXRpb24gPSB0aGlzLmZpcnN0UGVyc29uLmdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbihfdjNCKTtcclxuXHJcbiAgICAvLyBMb29rIGF0IGRpcmVjdGlvbiBpbiB3b3JsZCBjb29yZGluYXRlXHJcbiAgICBjb25zdCBsb29rQXREaXIgPSBfdjNDLmNvcHkocG9zaXRpb24pLnN1YihoZWFkUG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xyXG5cclxuICAgIC8vIFRyYW5zZm9ybSB0aGUgZGlyZWN0aW9uIGludG8gbG9jYWwgY29vcmRpbmF0ZSBmcm9tIHRoZSBmaXJzdCBwZXJzb24gYm9uZVxyXG4gICAgbG9va0F0RGlyLmFwcGx5UXVhdGVybmlvbihxdWF0SW52ZXJ0Q29tcGF0KGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5maXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmUsIF9xdWF0KSkpO1xyXG5cclxuICAgIC8vIGNvbnZlcnQgdGhlIGRpcmVjdGlvbiBpbnRvIGV1bGVyXHJcbiAgICB0YXJnZXQueCA9IE1hdGguYXRhbjIobG9va0F0RGlyLnksIE1hdGguc3FydChsb29rQXREaXIueCAqIGxvb2tBdERpci54ICsgbG9va0F0RGlyLnogKiBsb29rQXREaXIueikpO1xyXG4gICAgdGFyZ2V0LnkgPSBNYXRoLmF0YW4yKC1sb29rQXREaXIueCwgLWxvb2tBdERpci56KTtcclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0O1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xyXG5pbXBvcnQgeyBHTFRGTm9kZSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcclxuaW1wb3J0IHsgVlJNTG9va0F0SGVhZCB9IGZyb20gJy4vVlJNTG9va0F0SGVhZCc7XHJcblxyXG5jb25zdCBfZXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoMC4wLCAwLjAsIDAuMCwgVlJNTG9va0F0SGVhZC5FVUxFUl9PUkRFUik7XHJcblxyXG4vKipcclxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uIHRvIGV5ZSBib25lcyBvZiBhIFZSTS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRCb25lQXBwbHllciBleHRlbmRzIFZSTUxvb2tBdEFwcGx5ZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQm9uZTtcclxuXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVIb3Jpem9udGFsSW5uZXI6IFZSTUN1cnZlTWFwcGVyO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlSG9yaXpvbnRhbE91dGVyOiBWUk1DdXJ2ZU1hcHBlcjtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXI7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbFVwOiBWUk1DdXJ2ZU1hcHBlcjtcclxuXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfbGVmdEV5ZTogR0xURk5vZGUgfCBudWxsO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX3JpZ2h0RXllOiBHTFRGTm9kZSB8IG51bGw7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRCb25lQXBwbHllci5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIFtbVlJNSHVtYW5vaWRdXSB1c2VkIGJ5IHRoaXMgYXBwbGllclxyXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWxJbm5lciBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBpbm5lciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWxPdXRlciBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBvdXRlciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsRG93biBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBkb3duIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsVXAgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdXAgZGlyZWN0aW9uXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXHJcbiAgICBjdXJ2ZUhvcml6b250YWxJbm5lcjogVlJNQ3VydmVNYXBwZXIsXHJcbiAgICBjdXJ2ZUhvcml6b250YWxPdXRlcjogVlJNQ3VydmVNYXBwZXIsXHJcbiAgICBjdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXIsXHJcbiAgICBjdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyLFxyXG4gICkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLl9jdXJ2ZUhvcml6b250YWxJbm5lciA9IGN1cnZlSG9yaXpvbnRhbElubmVyO1xyXG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsT3V0ZXIgPSBjdXJ2ZUhvcml6b250YWxPdXRlcjtcclxuICAgIHRoaXMuX2N1cnZlVmVydGljYWxEb3duID0gY3VydmVWZXJ0aWNhbERvd247XHJcbiAgICB0aGlzLl9jdXJ2ZVZlcnRpY2FsVXAgPSBjdXJ2ZVZlcnRpY2FsVXA7XHJcblxyXG4gICAgdGhpcy5fbGVmdEV5ZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLkxlZnRFeWUpO1xyXG4gICAgdGhpcy5fcmlnaHRFeWUgPSBodW1hbm9pZC5nZXRCb25lTm9kZShWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZS5SaWdodEV5ZSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbG9va0F0KGV1bGVyOiBUSFJFRS5FdWxlcik6IHZvaWQge1xyXG4gICAgY29uc3Qgc3JjWCA9IGV1bGVyLng7XHJcbiAgICBjb25zdCBzcmNZID0gZXVsZXIueTtcclxuXHJcbiAgICAvLyBsZWZ0XHJcbiAgICBpZiAodGhpcy5fbGVmdEV5ZSkge1xyXG4gICAgICBpZiAoc3JjWCA8IDAuMCkge1xyXG4gICAgICAgIF9ldWxlci54ID0gLXRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX2V1bGVyLnggPSB0aGlzLl9jdXJ2ZVZlcnRpY2FsVXAubWFwKHNyY1gpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoc3JjWSA8IDAuMCkge1xyXG4gICAgICAgIF9ldWxlci55ID0gLXRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyLm1hcCgtc3JjWSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX2V1bGVyLnkgPSB0aGlzLl9jdXJ2ZUhvcml6b250YWxPdXRlci5tYXAoc3JjWSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMuX2xlZnRFeWUucXVhdGVybmlvbi5zZXRGcm9tRXVsZXIoX2V1bGVyKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyByaWdodFxyXG4gICAgaWYgKHRoaXMuX3JpZ2h0RXllKSB7XHJcbiAgICAgIGlmIChzcmNYIDwgMC4wKSB7XHJcbiAgICAgICAgX2V1bGVyLnggPSAtdGhpcy5fY3VydmVWZXJ0aWNhbERvd24ubWFwKC1zcmNYKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBfZXVsZXIueCA9IHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChzcmNZIDwgMC4wKSB7XHJcbiAgICAgICAgX2V1bGVyLnkgPSAtdGhpcy5fY3VydmVIb3Jpem9udGFsT3V0ZXIubWFwKC1zcmNZKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBfZXVsZXIueSA9IHRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyLm1hcChzcmNZKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5fcmlnaHRFeWUucXVhdGVybmlvbi5zZXRGcm9tRXVsZXIoX2V1bGVyKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xyXG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcclxuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbic7XHJcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xyXG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XHJcbmltcG9ydCB7IFZSTUxvb2tBdEFwcGx5ZXIgfSBmcm9tICcuL1ZSTUxvb2tBdEFwcGx5ZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRCb25lQXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0Qm9uZUFwcGx5ZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkJztcclxuXHJcbi8vIFRIUkVFLk1hdGggaGFzIGJlZW4gcmVuYW1lZCB0byBUSFJFRS5NYXRoVXRpbHMgc2luY2UgcjExMy5cclxuLy8gV2UgYXJlIGdvaW5nIHRvIGRlZmluZSB0aGUgREVHMlJBRCBieSBvdXJzZWx2ZXMgZm9yIGEgd2hpbGVcclxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzE4MjcwXHJcbmNvbnN0IERFRzJSQUQgPSBNYXRoLlBJIC8gMTgwOyAvLyBUSFJFRS5NYXRoVXRpbHMuREVHMlJBRDtcclxuXHJcbi8qKlxyXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUxvb2tBdEhlYWRdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SW1wb3J0ZXIge1xyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIFtbVlJNTG9va0F0SGVhZF1dIGZyb20gYSBWUk0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICAgKiBAcGFyYW0gYmxlbmRTaGFwZVByb3h5IEEgW1tWUk1CbGVuZFNoYXBlUHJveHldXSBpbnN0YW5jZSB0aGF0IHJlcHJlc2VudHMgdGhlIFZSTVxyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIFtbVlJNSHVtYW5vaWRdXSBpbnN0YW5jZSB0aGF0IHJlcHJlc2VudHMgdGhlIFZSTVxyXG4gICAqL1xyXG4gIHB1YmxpYyBpbXBvcnQoXHJcbiAgICBnbHRmOiBHTFRGLFxyXG4gICAgZmlyc3RQZXJzb246IFZSTUZpcnN0UGVyc29uLFxyXG4gICAgYmxlbmRTaGFwZVByb3h5OiBWUk1CbGVuZFNoYXBlUHJveHksXHJcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXHJcbiAgKTogVlJNTG9va0F0SGVhZCB8IG51bGwge1xyXG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XHJcbiAgICBpZiAoIXZybUV4dCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xyXG4gICAgaWYgKCFzY2hlbWFGaXJzdFBlcnNvbikge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhcHBseWVyID0gdGhpcy5faW1wb3J0QXBwbHllcihzY2hlbWFGaXJzdFBlcnNvbiwgYmxlbmRTaGFwZVByb3h5LCBodW1hbm9pZCk7XHJcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdEhlYWQoZmlyc3RQZXJzb24sIGFwcGx5ZXIgfHwgdW5kZWZpbmVkKTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBfaW1wb3J0QXBwbHllcihcclxuICAgIHNjaGVtYUZpcnN0UGVyc29uOiBWUk1TY2hlbWEuRmlyc3RQZXJzb24sXHJcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcclxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcclxuICApOiBWUk1Mb29rQXRBcHBseWVyIHwgbnVsbCB7XHJcbiAgICBjb25zdCBsb29rQXRIb3Jpem9udGFsSW5uZXIgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsSW5uZXI7XHJcbiAgICBjb25zdCBsb29rQXRIb3Jpem9udGFsT3V0ZXIgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsT3V0ZXI7XHJcbiAgICBjb25zdCBsb29rQXRWZXJ0aWNhbERvd24gPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRWZXJ0aWNhbERvd247XHJcbiAgICBjb25zdCBsb29rQXRWZXJ0aWNhbFVwID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VmVydGljYWxVcDtcclxuXHJcbiAgICBzd2l0Y2ggKHNjaGVtYUZpcnN0UGVyc29uLmxvb2tBdFR5cGVOYW1lKSB7XHJcbiAgICAgIGNhc2UgVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQm9uZToge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIGxvb2tBdEhvcml6b250YWxJbm5lciA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICBsb29rQXRIb3Jpem9udGFsT3V0ZXIgPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgbG9va0F0VmVydGljYWxEb3duID09PSB1bmRlZmluZWQgfHxcclxuICAgICAgICAgIGxvb2tBdFZlcnRpY2FsVXAgPT09IHVuZGVmaW5lZFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiBuZXcgVlJNTG9va0F0Qm9uZUFwcGx5ZXIoXHJcbiAgICAgICAgICAgIGh1bWFub2lkLFxyXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobG9va0F0SG9yaXpvbnRhbElubmVyKSxcclxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdEhvcml6b250YWxPdXRlciksXHJcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRWZXJ0aWNhbERvd24pLFxyXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobG9va0F0VmVydGljYWxVcCksXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBjYXNlIFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU6IHtcclxuICAgICAgICBpZiAobG9va0F0SG9yaXpvbnRhbE91dGVyID09PSB1bmRlZmluZWQgfHwgbG9va0F0VmVydGljYWxEb3duID09PSB1bmRlZmluZWQgfHwgbG9va0F0VmVydGljYWxVcCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllcihcclxuICAgICAgICAgICAgYmxlbmRTaGFwZVByb3h5LFxyXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobG9va0F0SG9yaXpvbnRhbE91dGVyKSxcclxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCbGVuZFNoYXBlKGxvb2tBdFZlcnRpY2FsRG93biksXHJcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShsb29rQXRWZXJ0aWNhbFVwKSxcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfaW1wb3J0Q3VydmVNYXBwZXJCb25lKG1hcDogVlJNU2NoZW1hLkZpcnN0UGVyc29uRGVncmVlTWFwKTogVlJNQ3VydmVNYXBwZXIge1xyXG4gICAgcmV0dXJuIG5ldyBWUk1DdXJ2ZU1hcHBlcihcclxuICAgICAgdHlwZW9mIG1hcC54UmFuZ2UgPT09ICdudW1iZXInID8gREVHMlJBRCAqIG1hcC54UmFuZ2UgOiB1bmRlZmluZWQsXHJcbiAgICAgIHR5cGVvZiBtYXAueVJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueVJhbmdlIDogdW5kZWZpbmVkLFxyXG4gICAgICBtYXAuY3VydmUsXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfaW1wb3J0Q3VydmVNYXBwZXJCbGVuZFNoYXBlKG1hcDogVlJNU2NoZW1hLkZpcnN0UGVyc29uRGVncmVlTWFwKTogVlJNQ3VydmVNYXBwZXIge1xyXG4gICAgcmV0dXJuIG5ldyBWUk1DdXJ2ZU1hcHBlcih0eXBlb2YgbWFwLnhSYW5nZSA9PT0gJ251bWJlcicgPyBERUcyUkFEICogbWFwLnhSYW5nZSA6IHVuZGVmaW5lZCwgbWFwLnlSYW5nZSwgbWFwLmN1cnZlKTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuZXhwb3J0IGNvbnN0IGdldEVuY29kaW5nQ29tcG9uZW50cyA9IChlbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nKTogW3N0cmluZywgc3RyaW5nXSA9PiB7XHJcbiAgc3dpdGNoIChlbmNvZGluZykge1xyXG4gICAgY2FzZSBUSFJFRS5MaW5lYXJFbmNvZGluZzpcclxuICAgICAgcmV0dXJuIFsnTGluZWFyJywgJyggdmFsdWUgKSddO1xyXG4gICAgY2FzZSBUSFJFRS5zUkdCRW5jb2Rpbmc6XHJcbiAgICAgIHJldHVybiBbJ3NSR0InLCAnKCB2YWx1ZSApJ107XHJcbiAgICBjYXNlIFRIUkVFLlJHQkVFbmNvZGluZzpcclxuICAgICAgcmV0dXJuIFsnUkdCRScsICcoIHZhbHVlICknXTtcclxuICAgIGNhc2UgVEhSRUUuUkdCTTdFbmNvZGluZzpcclxuICAgICAgcmV0dXJuIFsnUkdCTScsICcoIHZhbHVlLCA3LjAgKSddO1xyXG4gICAgY2FzZSBUSFJFRS5SR0JNMTZFbmNvZGluZzpcclxuICAgICAgcmV0dXJuIFsnUkdCTScsICcoIHZhbHVlLCAxNi4wICknXTtcclxuICAgIGNhc2UgVEhSRUUuUkdCREVuY29kaW5nOlxyXG4gICAgICByZXR1cm4gWydSR0JEJywgJyggdmFsdWUsIDI1Ni4wICknXTtcclxuICAgIGNhc2UgVEhSRUUuR2FtbWFFbmNvZGluZzpcclxuICAgICAgcmV0dXJuIFsnR2FtbWEnLCAnKCB2YWx1ZSwgZmxvYXQoIEdBTU1BX0ZBQ1RPUiApICknXTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgZW5jb2Rpbmc6ICcgKyBlbmNvZGluZyk7XHJcbiAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbiA9IChmdW5jdGlvbk5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZyk6IHN0cmluZyA9PiB7XHJcbiAgY29uc3QgY29tcG9uZW50cyA9IGdldEVuY29kaW5nQ29tcG9uZW50cyhlbmNvZGluZyk7XHJcbiAgcmV0dXJuICd2ZWM0ICcgKyBmdW5jdGlvbk5hbWUgKyAnKCB2ZWM0IHZhbHVlICkgeyByZXR1cm4gJyArIGNvbXBvbmVudHNbMF0gKyAnVG9MaW5lYXInICsgY29tcG9uZW50c1sxXSArICc7IH0nO1xyXG59O1xyXG4iLCIvKiB0c2xpbnQ6ZGlzYWJsZTptZW1iZXItb3JkZXJpbmcgKi9cclxuXHJcbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uIH0gZnJvbSAnLi9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24nO1xyXG5pbXBvcnQgdmVydGV4U2hhZGVyIGZyb20gJy4vc2hhZGVycy9tdG9vbi52ZXJ0JztcclxuaW1wb3J0IGZyYWdtZW50U2hhZGVyIGZyb20gJy4vc2hhZGVycy9tdG9vbi5mcmFnJztcclxuXHJcbmNvbnN0IFRBVSA9IDIuMCAqIE1hdGguUEk7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1Ub29uUGFyYW1ldGVycyBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsUGFyYW1ldGVycyB7XHJcbiAgbVRvb25WZXJzaW9uPzogbnVtYmVyOyAvLyBfTVRvb25WZXJzaW9uXHJcblxyXG4gIGN1dG9mZj86IG51bWJlcjsgLy8gX0N1dG9mZlxyXG4gIGNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gcmdiIG9mIF9Db2xvclxyXG4gIHNoYWRlQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfU2hhZGVDb2xvclxyXG4gIG1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4XHJcbiAgbWFpblRleD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4ICh3aWxsIGJlIHJlbmFtZWQgdG8gbWFwKVxyXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cclxuICBtYWluVGV4X1NUPzogVEhSRUUuVmVjdG9yNDsgLy8gX01haW5UZXhfU1RcclxuICBzaGFkZVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU2hhZGVUZXh0dXJlXHJcbiAgYnVtcFNjYWxlPzogbnVtYmVyOyAvLyBfQnVtcFNjYWxlICh3aWxsIGJlIGNvbnZlcnRlZCB0byBub3JtYWxTY2FsZSlcclxuICBub3JtYWxNYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfQnVtcE1hcFxyXG4gIG5vcm1hbE1hcFR5cGU/OiBUSFJFRS5Ob3JtYWxNYXBUeXBlczsgLy8gVGhyZWUuanMgc3BlY2lmaWMgdmFsdWVcclxuICBub3JtYWxTY2FsZT86IFRIUkVFLlZlY3RvcjI7IC8vIF9CdW1wU2NhbGUgaW4gVGhyZWUuanMgZmFzaGlvblxyXG4gIGJ1bXBNYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfQnVtcE1hcCAod2lsbCBiZSByZW5hbWVkIHRvIG5vcm1hbE1hcClcclxuICByZWNlaXZlU2hhZG93UmF0ZT86IG51bWJlcjsgLy8gX1JlY2VpdmVTaGFkb3dSYXRlXHJcbiAgcmVjZWl2ZVNoYWRvd1RleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVcclxuICBzaGFkaW5nR3JhZGVSYXRlPzogbnVtYmVyOyAvLyBfU2hhZGluZ0dyYWRlUmF0ZVxyXG4gIHNoYWRpbmdHcmFkZVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU2hhZGluZ0dyYWRlVGV4dHVyZVxyXG4gIHNoYWRlU2hpZnQ/OiBudW1iZXI7IC8vIF9TaGFkZVNoaWZ0XHJcbiAgc2hhZGVUb29ueT86IG51bWJlcjsgLy8gX1NoYWRlVG9vbnlcclxuICBsaWdodENvbG9yQXR0ZW51YXRpb24/OiBudW1iZXI7IC8vIF9MaWdodENvbG9yQXR0ZW51YXRpb25cclxuICBpbmRpcmVjdExpZ2h0SW50ZW5zaXR5PzogbnVtYmVyOyAvLyBfSW5kaXJlY3RMaWdodEludGVuc2l0eVxyXG4gIHJpbVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfUmltVGV4dHVyZVxyXG4gIHJpbUNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gX1JpbUNvbG9yXHJcbiAgcmltTGlnaHRpbmdNaXg/OiBudW1iZXI7IC8vIF9SaW1MaWdodGluZ01peFxyXG4gIHJpbUZyZXNuZWxQb3dlcj86IG51bWJlcjsgLy8gX1JpbUZyZXNuZWxQb3dlclxyXG4gIHJpbUxpZnQ/OiBudW1iZXI7IC8vIF9SaW1MaWZ0XHJcbiAgc3BoZXJlQWRkPzogVEhSRUUuVGV4dHVyZTsgLy8gX1NwaGVyZUFkZFxyXG4gIGVtaXNzaW9uQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfRW1pc3Npb25Db2xvclxyXG4gIGVtaXNzaXZlTWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX0VtaXNzaW9uTWFwXHJcbiAgZW1pc3Npb25NYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfRW1pc3Npb25NYXAgKHdpbGwgYmUgcmVuYW1lZCB0byBlbWlzc2l2ZU1hcClcclxuICBvdXRsaW5lV2lkdGhUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcclxuICBvdXRsaW5lV2lkdGg/OiBudW1iZXI7IC8vIF9PdXRsaW5lV2lkdGhcclxuICBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U/OiBudW1iZXI7IC8vIF9PdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2VcclxuICBvdXRsaW5lQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfT3V0bGluZUNvbG9yXHJcbiAgb3V0bGluZUxpZ2h0aW5nTWl4PzogbnVtYmVyOyAvLyBfT3V0bGluZUxpZ2h0aW5nTWl4XHJcbiAgdXZBbmltTWFza1RleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfVXZBbmltTWFza1RleHR1cmVcclxuICB1dkFuaW1TY3JvbGxYPzogbnVtYmVyOyAvLyBfVXZBbmltU2Nyb2xsWFxyXG4gIHV2QW5pbVNjcm9sbFk/OiBudW1iZXI7IC8vIF9VdkFuaW1TY3JvbGxZXHJcbiAgdXZBbmltUm90YXRpb24/OiBudW1iZXI7IC8vIF91dkFuaW1Sb3RhdGlvblxyXG5cclxuICBkZWJ1Z01vZGU/OiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHwgbnVtYmVyOyAvLyBfRGVidWdNb2RlXHJcbiAgYmxlbmRNb2RlPzogTVRvb25NYXRlcmlhbFJlbmRlck1vZGUgfCBudW1iZXI7IC8vIF9CbGVuZE1vZGVcclxuICBvdXRsaW5lV2lkdGhNb2RlPzogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgfCBudW1iZXI7IC8vIE91dGxpbmVXaWR0aE1vZGVcclxuICBvdXRsaW5lQ29sb3JNb2RlPzogTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUgfCBudW1iZXI7IC8vIE91dGxpbmVDb2xvck1vZGVcclxuICBjdWxsTW9kZT86IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSB8IG51bWJlcjsgLy8gX0N1bGxNb2RlXHJcbiAgb3V0bGluZUN1bGxNb2RlPzogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHwgbnVtYmVyOyAvLyBfT3V0bGluZUN1bGxNb2RlXHJcbiAgc3JjQmxlbmQ/OiBudW1iZXI7IC8vIF9TcmNCbGVuZFxyXG4gIGRzdEJsZW5kPzogbnVtYmVyOyAvLyBfRHN0QmxlbmRcclxuICB6V3JpdGU/OiBudW1iZXI7IC8vIF9aV3JpdGUgKHdpbGwgYmUgcmVuYW1lZCB0byBkZXB0aFdyaXRlKVxyXG5cclxuICBpc091dGxpbmU/OiBib29sZWFuO1xyXG5cclxuICAvKipcclxuICAgKiBTcGVjaWZ5IHRoZSBlbmNvZGluZyBvZiBpbnB1dCB1bmlmb3JtIGNvbG9ycy5cclxuICAgKlxyXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxyXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5zUkdCRW5jb2RpbmdgLCB1c2UgYFRIUkVFLnNSR0JFbmNvZGluZ2AuXHJcbiAgICpcclxuICAgKiBFbmNvZGluZ3Mgb2YgdGV4dHVyZXMgc2hvdWxkIGJlIHNldCBpbmRlcGVuZGVudGx5IG9uIHRleHR1cmVzLlxyXG4gICAqXHJcbiAgICogVGhpcyB3aWxsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGlmIHRoaXMgb3B0aW9uIGlzbid0IHNwZWNpZmllZC5cclxuICAgKlxyXG4gICAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9yZW5kZXJlcnMvV2ViR0xSZW5kZXJlci5vdXRwdXRFbmNvZGluZ1xyXG4gICAqL1xyXG4gIGVuY29kaW5nPzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xyXG59XHJcblxyXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUge1xyXG4gIE9mZixcclxuICBGcm9udCxcclxuICBCYWNrLFxyXG59XHJcblxyXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHtcclxuICBOb25lLFxyXG4gIE5vcm1hbCxcclxuICBMaXRTaGFkZVJhdGUsXHJcbiAgVVYsXHJcbn1cclxuXHJcbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIHtcclxuICBGaXhlZENvbG9yLFxyXG4gIE1peGVkTGlnaHRpbmcsXHJcbn1cclxuXHJcbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcclxuICBOb25lLFxyXG4gIFdvcmxkQ29vcmRpbmF0ZXMsXHJcbiAgU2NyZWVuQ29vcmRpbmF0ZXMsXHJcbn1cclxuXHJcbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcclxuICBPcGFxdWUsXHJcbiAgQ3V0b3V0LFxyXG4gIFRyYW5zcGFyZW50LFxyXG4gIFRyYW5zcGFyZW50V2l0aFpXcml0ZSxcclxufVxyXG5cclxuLyoqXHJcbiAqIE1Ub29uIGlzIGEgbWF0ZXJpYWwgc3BlY2lmaWNhdGlvbiB0aGF0IGhhcyB2YXJpb3VzIGZlYXR1cmVzLlxyXG4gKiBUaGUgc3BlYyBhbmQgaW1wbGVtZW50YXRpb24gYXJlIG9yaWdpbmFsbHkgZm91bmRlZCBmb3IgVW5pdHkgZW5naW5lIGFuZCB0aGlzIGlzIGEgcG9ydCBvZiB0aGUgbWF0ZXJpYWwuXHJcbiAqXHJcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1NhbnRhcmgvTVRvb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBNVG9vbk1hdGVyaWFsIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWwge1xyXG4gIC8qKlxyXG4gICAqIFJlYWRvbmx5IGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhpcyBpcyBhIFtbTVRvb25NYXRlcmlhbF1dLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpc01Ub29uTWF0ZXJpYWw6IGJvb2xlYW4gPSB0cnVlO1xyXG5cclxuICBwdWJsaWMgY3V0b2ZmID0gMC41OyAvLyBfQ3V0b2ZmXHJcbiAgcHVibGljIGNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMS4wLCAxLjAsIDEuMCwgMS4wKTsgLy8gX0NvbG9yXHJcbiAgcHVibGljIHNoYWRlQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjk3LCAwLjgxLCAwLjg2LCAxLjApOyAvLyBfU2hhZGVDb2xvclxyXG4gIHB1YmxpYyBtYXA6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX01haW5UZXhcclxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXHJcbiAgcHVibGljIG1haW5UZXhfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfTWFpblRleF9TVFxyXG4gIHB1YmxpYyBzaGFkZVRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1NoYWRlVGV4dHVyZVxyXG4gIC8vIHB1YmxpYyBzaGFkZVRleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfU2hhZGVUZXh0dXJlX1NUICh1bnVzZWQpXHJcbiAgcHVibGljIG5vcm1hbE1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfQnVtcE1hcC4gYWdhaW4sIFRISVMgSVMgX0J1bXBNYXBcclxuICBwdWJsaWMgbm9ybWFsTWFwVHlwZSA9IFRIUkVFLlRhbmdlbnRTcGFjZU5vcm1hbE1hcDsgLy8gVGhyZWUuanMgcmVxdWlyZXMgdGhpc1xyXG4gIHB1YmxpYyBub3JtYWxTY2FsZSA9IG5ldyBUSFJFRS5WZWN0b3IyKDEuMCwgMS4wKTsgLy8gX0J1bXBTY2FsZSwgaW4gVmVjdG9yMlxyXG4gIC8vIHB1YmxpYyBidW1wTWFwX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX0J1bXBNYXBfU1QgKHVudXNlZClcclxuICBwdWJsaWMgcmVjZWl2ZVNoYWRvd1JhdGUgPSAxLjA7IC8vIF9SZWNlaXZlU2hhZG93UmF0ZVxyXG4gIHB1YmxpYyByZWNlaXZlU2hhZG93VGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVcclxuICAvLyBwdWJsaWMgcmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgKHVudXNlZClcclxuICBwdWJsaWMgc2hhZGluZ0dyYWRlUmF0ZSA9IDEuMDsgLy8gX1NoYWRpbmdHcmFkZVJhdGVcclxuICBwdWJsaWMgc2hhZGluZ0dyYWRlVGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfU2hhZGluZ0dyYWRlVGV4dHVyZVxyXG4gIC8vIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1NoYWRpbmdHcmFkZVRleHR1cmVfU1QgKHVudXNlZClcclxuICBwdWJsaWMgc2hhZGVTaGlmdCA9IDAuMDsgLy8gX1NoYWRlU2hpZnRcclxuICBwdWJsaWMgc2hhZGVUb29ueSA9IDAuOTsgLy8gX1NoYWRlVG9vbnlcclxuICBwdWJsaWMgbGlnaHRDb2xvckF0dGVudWF0aW9uID0gMC4wOyAvLyBfTGlnaHRDb2xvckF0dGVudWF0aW9uXHJcbiAgcHVibGljIGluZGlyZWN0TGlnaHRJbnRlbnNpdHkgPSAwLjE7IC8vIF9JbmRpcmVjdExpZ2h0SW50ZW5zaXR5XHJcbiAgcHVibGljIHJpbVRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1JpbVRleHR1cmVcclxuICBwdWJsaWMgcmltQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMC4wLCAxLjApOyAvLyBfUmltQ29sb3JcclxuICBwdWJsaWMgcmltTGlnaHRpbmdNaXggPSAwLjA7IC8vIF9SaW1MaWdodGluZ01peFxyXG4gIHB1YmxpYyByaW1GcmVzbmVsUG93ZXIgPSAxLjA7IC8vIF9SaW1GcmVzbmVsUG93ZXJcclxuICBwdWJsaWMgcmltTGlmdCA9IDAuMDsgLy8gX1JpbUxpZnRcclxuICBwdWJsaWMgc3BoZXJlQWRkOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TcGhlcmVBZGRcclxuICAvLyBwdWJsaWMgc3BoZXJlQWRkX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1NwaGVyZUFkZF9TVCAodW51c2VkKVxyXG4gIHB1YmxpYyBlbWlzc2lvbkNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDAuMCwgMS4wKTsgLy8gX0VtaXNzaW9uQ29sb3JcclxuICBwdWJsaWMgZW1pc3NpdmVNYXA6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX0VtaXNzaW9uTWFwXHJcbiAgLy8gcHVibGljIGVtaXNzaW9uTWFwX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX0VtaXNzaW9uTWFwX1NUICh1bnVzZWQpXHJcbiAgcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcclxuICAvLyBwdWJsaWMgb3V0bGluZVdpZHRoVGV4dHVyZV9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9PdXRsaW5lV2lkdGhUZXh0dXJlX1NUICh1bnVzZWQpXHJcbiAgcHVibGljIG91dGxpbmVXaWR0aCA9IDAuNTsgLy8gX091dGxpbmVXaWR0aFxyXG4gIHB1YmxpYyBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UgPSAxLjA7IC8vIF9PdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2VcclxuICBwdWJsaWMgb3V0bGluZUNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDAuMCwgMS4wKTsgLy8gX091dGxpbmVDb2xvclxyXG4gIHB1YmxpYyBvdXRsaW5lTGlnaHRpbmdNaXggPSAxLjA7IC8vIF9PdXRsaW5lTGlnaHRpbmdNaXhcclxuICBwdWJsaWMgdXZBbmltTWFza1RleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1V2QW5pbU1hc2tUZXh0dXJlXHJcbiAgcHVibGljIHV2QW5pbVNjcm9sbFggPSAwLjA7IC8vIF9VdkFuaW1TY3JvbGxYXHJcbiAgcHVibGljIHV2QW5pbVNjcm9sbFkgPSAwLjA7IC8vIF9VdkFuaW1TY3JvbGxZXHJcbiAgcHVibGljIHV2QW5pbVJvdGF0aW9uID0gMC4wOyAvLyBfdXZBbmltUm90YXRpb25cclxuXHJcbiAgcHVibGljIHNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlOyAvLyB3aGVuIHRoaXMgaXMgdHJ1ZSwgYXBwbHlVbmlmb3JtcyBlZmZlY3RzXHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBlbmNvZGluZyBvZiBpbnB1dCB1bmlmb3JtIGNvbG9ycy5cclxuICAgKlxyXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxyXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5zUkdCRW5jb2RpbmdgLCB1c2UgYFRIUkVFLnNSR0JFbmNvZGluZ2AuXHJcbiAgICpcclxuICAgKiBFbmNvZGluZ3Mgb2YgdGV4dHVyZXMgYXJlIHNldCBpbmRlcGVuZGVudGx5IG9uIHRleHR1cmVzLlxyXG4gICAqXHJcbiAgICogVGhpcyBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGJ5IGRlZmF1bHQuXHJcbiAgICpcclxuICAgKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vcmVuZGVyZXJzL1dlYkdMUmVuZGVyZXIub3V0cHV0RW5jb2RpbmdcclxuICAgKi9cclxuICBwdWJsaWMgZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZztcclxuXHJcbiAgcHJpdmF0ZSBfZGVidWdNb2RlID0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5Ob25lOyAvLyBfRGVidWdNb2RlXHJcbiAgcHJpdmF0ZSBfYmxlbmRNb2RlID0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuT3BhcXVlOyAvLyBfQmxlbmRNb2RlXHJcbiAgcHJpdmF0ZSBfb3V0bGluZVdpZHRoTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLk5vbmU7IC8vIF9PdXRsaW5lV2lkdGhNb2RlXHJcbiAgcHJpdmF0ZSBfb3V0bGluZUNvbG9yTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlLkZpeGVkQ29sb3I7IC8vIF9PdXRsaW5lQ29sb3JNb2RlXHJcbiAgcHJpdmF0ZSBfY3VsbE1vZGUgPSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuQmFjazsgLy8gX0N1bGxNb2RlXHJcbiAgcHJpdmF0ZSBfb3V0bGluZUN1bGxNb2RlID0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkZyb250OyAvLyBfT3V0bGluZUN1bGxNb2RlXHJcbiAgLy8gcHVibGljIHNyY0JsZW5kID0gMS4wOyAvLyBfU3JjQmxlbmQgKGlzIG5vdCBzdXBwb3J0ZWQpXHJcbiAgLy8gcHVibGljIGRzdEJsZW5kID0gMC4wOyAvLyBfRHN0QmxlbmQgKGlzIG5vdCBzdXBwb3J0ZWQpXHJcbiAgLy8gcHVibGljIHpXcml0ZSA9IDEuMDsgLy8gX1pXcml0ZSAod2lsbCBiZSBjb252ZXJ0ZWQgdG8gZGVwdGhXcml0ZSlcclxuXHJcbiAgcHJpdmF0ZSBfaXNPdXRsaW5lID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFggPSAwLjA7XHJcbiAgcHJpdmF0ZSBfdXZBbmltT2Zmc2V0WSA9IDAuMDtcclxuICBwcml2YXRlIF91dkFuaW1QaGFzZSA9IDAuMDtcclxuXHJcbiAgY29uc3RydWN0b3IocGFyYW1ldGVyczogTVRvb25QYXJhbWV0ZXJzID0ge30pIHtcclxuICAgIHN1cGVyKCk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGluZyA9IHBhcmFtZXRlcnMuZW5jb2RpbmcgfHwgVEhSRUUuTGluZWFyRW5jb2Rpbmc7XHJcbiAgICBpZiAodGhpcy5lbmNvZGluZyAhPT0gVEhSRUUuTGluZWFyRW5jb2RpbmcgJiYgdGhpcy5lbmNvZGluZyAhPT0gVEhSRUUuc1JHQkVuY29kaW5nKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICAnVGhlIHNwZWNpZmllZCBjb2xvciBlbmNvZGluZyBkb2VzIG5vdCB3b3JrIHByb3Blcmx5IHdpdGggTVRvb25NYXRlcmlhbC4gWW91IG1pZ2h0IHdhbnQgdG8gdXNlIFRIUkVFLnNSR0JFbmNvZGluZyBpbnN0ZWFkLicsXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT0gdGhlc2UgcGFyYW1ldGVyIGhhcyBubyBjb21wYXRpYmlsaXR5IHdpdGggdGhpcyBpbXBsZW1lbnRhdGlvbiA9PT09PT09PVxyXG4gICAgW1xyXG4gICAgICAnbVRvb25WZXJzaW9uJyxcclxuICAgICAgJ3NoYWRlVGV4dHVyZV9TVCcsXHJcbiAgICAgICdidW1wTWFwX1NUJyxcclxuICAgICAgJ3JlY2VpdmVTaGFkb3dUZXh0dXJlX1NUJyxcclxuICAgICAgJ3NoYWRpbmdHcmFkZVRleHR1cmVfU1QnLFxyXG4gICAgICAncmltVGV4dHVyZV9TVCcsXHJcbiAgICAgICdzcGhlcmVBZGRfU1QnLFxyXG4gICAgICAnZW1pc3Npb25NYXBfU1QnLFxyXG4gICAgICAnb3V0bGluZVdpZHRoVGV4dHVyZV9TVCcsXHJcbiAgICAgICd1dkFuaW1NYXNrVGV4dHVyZV9TVCcsXHJcbiAgICAgICdzcmNCbGVuZCcsXHJcbiAgICAgICdkc3RCbGVuZCcsXHJcbiAgICBdLmZvckVhY2goKGtleSkgPT4ge1xyXG4gICAgICBpZiAoKHBhcmFtZXRlcnMgYXMgYW55KVtrZXldICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAvLyBjb25zb2xlLndhcm4oYFRIUkVFLiR7dGhpcy50eXBlfTogVGhlIHBhcmFtZXRlciBcIiR7a2V5fVwiIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XHJcbiAgICAgICAgZGVsZXRlIChwYXJhbWV0ZXJzIGFzIGFueSlba2V5XTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT0gZW5hYmxpbmcgYnVuY2ggb2Ygc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgcGFyYW1ldGVycy5mb2cgPSB0cnVlO1xyXG4gICAgcGFyYW1ldGVycy5saWdodHMgPSB0cnVlO1xyXG4gICAgcGFyYW1ldGVycy5jbGlwcGluZyA9IHRydWU7XHJcblxyXG4gICAgcGFyYW1ldGVycy5za2lubmluZyA9IHBhcmFtZXRlcnMuc2tpbm5pbmcgfHwgZmFsc2U7XHJcbiAgICBwYXJhbWV0ZXJzLm1vcnBoVGFyZ2V0cyA9IHBhcmFtZXRlcnMubW9ycGhUYXJnZXRzIHx8IGZhbHNlO1xyXG4gICAgcGFyYW1ldGVycy5tb3JwaE5vcm1hbHMgPSBwYXJhbWV0ZXJzLm1vcnBoTm9ybWFscyB8fCBmYWxzZTtcclxuXHJcbiAgICAvLyA9PSB1bmlmb3JtcyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBwYXJhbWV0ZXJzLnVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5tZXJnZShbXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmNvbW1vbiwgLy8gbWFwXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLm5vcm1hbG1hcCwgLy8gbm9ybWFsTWFwXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmVtaXNzaXZlbWFwLCAvLyBlbWlzc2l2ZU1hcFxyXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmxpZ2h0cyxcclxuICAgICAge1xyXG4gICAgICAgIGN1dG9mZjogeyB2YWx1ZTogMC41IH0sXHJcbiAgICAgICAgY29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigxLjAsIDEuMCwgMS4wKSB9LFxyXG4gICAgICAgIGNvbG9yQWxwaGE6IHsgdmFsdWU6IDEuMCB9LFxyXG4gICAgICAgIHNoYWRlQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjk3LCAwLjgxLCAwLjg2KSB9LFxyXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cclxuICAgICAgICBtYWluVGV4X1NUOiB7IHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApIH0sXHJcbiAgICAgICAgc2hhZGVUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgcmVjZWl2ZVNoYWRvd1JhdGU6IHsgdmFsdWU6IDEuMCB9LFxyXG4gICAgICAgIHJlY2VpdmVTaGFkb3dUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgc2hhZGluZ0dyYWRlUmF0ZTogeyB2YWx1ZTogMS4wIH0sXHJcbiAgICAgICAgc2hhZGluZ0dyYWRlVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIHNoYWRlU2hpZnQ6IHsgdmFsdWU6IDAuMCB9LFxyXG4gICAgICAgIHNoYWRlVG9vbnk6IHsgdmFsdWU6IDAuOSB9LFxyXG4gICAgICAgIGxpZ2h0Q29sb3JBdHRlbnVhdGlvbjogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgICAgaW5kaXJlY3RMaWdodEludGVuc2l0eTogeyB2YWx1ZTogMC4xIH0sXHJcbiAgICAgICAgcmltVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIHJpbUNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcclxuICAgICAgICByaW1MaWdodGluZ01peDogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgICAgcmltRnJlc25lbFBvd2VyOiB7IHZhbHVlOiAxLjAgfSxcclxuICAgICAgICByaW1MaWZ0OiB7IHZhbHVlOiAwLjAgfSxcclxuICAgICAgICBzcGhlcmVBZGQ6IHsgdmFsdWU6IG51bGwgfSxcclxuICAgICAgICBlbWlzc2lvbkNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcclxuICAgICAgICBvdXRsaW5lV2lkdGhUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgb3V0bGluZVdpZHRoOiB7IHZhbHVlOiAwLjUgfSxcclxuICAgICAgICBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U6IHsgdmFsdWU6IDEuMCB9LFxyXG4gICAgICAgIG91dGxpbmVDb2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXHJcbiAgICAgICAgb3V0bGluZUxpZ2h0aW5nTWl4OiB7IHZhbHVlOiAxLjAgfSxcclxuICAgICAgICB1dkFuaW1NYXNrVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIHV2QW5pbU9mZnNldFg6IHsgdmFsdWU6IDAuMCB9LFxyXG4gICAgICAgIHV2QW5pbU9mZnNldFk6IHsgdmFsdWU6IDAuMCB9LFxyXG4gICAgICAgIHV2QW5pbVRoZXRhOiB7IHZhbHVlOiAwLjAgfSxcclxuICAgICAgfSxcclxuICAgIF0pO1xyXG5cclxuICAgIC8vID09IGZpbmFsbHkgY29tcGlsZSB0aGUgc2hhZGVyIHByb2dyYW0gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMuc2V0VmFsdWVzKHBhcmFtZXRlcnMpO1xyXG5cclxuICAgIC8vID09IHVwZGF0ZSBzaGFkZXIgc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcclxuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcclxuICB9XHJcblxyXG4gIGdldCBtYWluVGV4KCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLm1hcDtcclxuICB9XHJcblxyXG4gIHNldCBtYWluVGV4KHQ6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLm1hcCA9IHQ7XHJcbiAgfVxyXG5cclxuICBnZXQgYnVtcE1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5ub3JtYWxNYXA7XHJcbiAgfVxyXG5cclxuICBzZXQgYnVtcE1hcCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy5ub3JtYWxNYXAgPSB0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0dGluZyB0aGUgYGJ1bXBTY2FsZWAgcmV1dHJucyBpdHMgeCBjb21wb25lbnQgb2YgYG5vcm1hbFNjYWxlYCAoYXNzdW1pbmcgeCBhbmQgeSBjb21wb25lbnQgb2YgYG5vcm1hbFNjYWxlYCBhcmUgc2FtZSkuXHJcbiAgICovXHJcbiAgZ2V0IGJ1bXBTY2FsZSgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMubm9ybWFsU2NhbGUueDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHRpbmcgdGhlIGBidW1wU2NhbGVgIHdpbGwgYmUgY29udmVydCB0aGUgdmFsdWUgaW50byBWZWN0b3IyIGBub3JtYWxTY2FsZWAgLlxyXG4gICAqL1xyXG4gIHNldCBidW1wU2NhbGUodDogbnVtYmVyKSB7XHJcbiAgICB0aGlzLm5vcm1hbFNjYWxlLnNldCh0LCB0KTtcclxuICB9XHJcblxyXG4gIGdldCBlbWlzc2lvbk1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5lbWlzc2l2ZU1hcDtcclxuICB9XHJcblxyXG4gIHNldCBlbWlzc2lvbk1hcCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy5lbWlzc2l2ZU1hcCA9IHQ7XHJcbiAgfVxyXG5cclxuICBnZXQgYmxlbmRNb2RlKCk6IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcclxuICAgIHJldHVybiB0aGlzLl9ibGVuZE1vZGU7XHJcbiAgfVxyXG5cclxuICBzZXQgYmxlbmRNb2RlKG06IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlKSB7XHJcbiAgICB0aGlzLl9ibGVuZE1vZGUgPSBtO1xyXG5cclxuICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRoaXMuX2JsZW5kTW9kZSAhPT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuVHJhbnNwYXJlbnQ7XHJcbiAgICB0aGlzLnRyYW5zcGFyZW50ID1cclxuICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudCB8fFxyXG4gICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcclxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcclxuICB9XHJcblxyXG4gIGdldCBkZWJ1Z01vZGUoKTogTVRvb25NYXRlcmlhbERlYnVnTW9kZSB7XHJcbiAgICByZXR1cm4gdGhpcy5fZGVidWdNb2RlO1xyXG4gIH1cclxuXHJcbiAgc2V0IGRlYnVnTW9kZShtOiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlKSB7XHJcbiAgICB0aGlzLl9kZWJ1Z01vZGUgPSBtO1xyXG5cclxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcclxuICB9XHJcblxyXG4gIGdldCBvdXRsaW5lV2lkdGhNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcclxuICAgIHJldHVybiB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlO1xyXG4gIH1cclxuXHJcbiAgc2V0IG91dGxpbmVXaWR0aE1vZGUobTogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUpIHtcclxuICAgIHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPSBtO1xyXG5cclxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcclxuICB9XHJcblxyXG4gIGdldCBvdXRsaW5lQ29sb3JNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIHtcclxuICAgIHJldHVybiB0aGlzLl9vdXRsaW5lQ29sb3JNb2RlO1xyXG4gIH1cclxuXHJcbiAgc2V0IG91dGxpbmVDb2xvck1vZGUobTogTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUpIHtcclxuICAgIHRoaXMuX291dGxpbmVDb2xvck1vZGUgPSBtO1xyXG5cclxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcclxuICB9XHJcblxyXG4gIGdldCBjdWxsTW9kZSgpOiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUge1xyXG4gICAgcmV0dXJuIHRoaXMuX2N1bGxNb2RlO1xyXG4gIH1cclxuXHJcbiAgc2V0IGN1bGxNb2RlKG06IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSkge1xyXG4gICAgdGhpcy5fY3VsbE1vZGUgPSBtO1xyXG5cclxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XHJcbiAgfVxyXG5cclxuICBnZXQgb3V0bGluZUN1bGxNb2RlKCk6IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSB7XHJcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZUN1bGxNb2RlO1xyXG4gIH1cclxuXHJcbiAgc2V0IG91dGxpbmVDdWxsTW9kZShtOiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUpIHtcclxuICAgIHRoaXMuX291dGxpbmVDdWxsTW9kZSA9IG07XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcclxuICB9XHJcblxyXG4gIGdldCB6V3JpdGUoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLmRlcHRoV3JpdGUgPyAxIDogMDtcclxuICB9XHJcblxyXG4gIHNldCB6V3JpdGUoaTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLmRlcHRoV3JpdGUgPSAwLjUgPD0gaTtcclxuICB9XHJcblxyXG4gIGdldCBpc091dGxpbmUoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5faXNPdXRsaW5lO1xyXG4gIH1cclxuXHJcbiAgc2V0IGlzT3V0bGluZShiOiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl9pc091dGxpbmUgPSBiO1xyXG5cclxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcclxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhpcyBtYXRlcmlhbC5cclxuICAgKiBVc3VhbGx5IHRoaXMgd2lsbCBiZSBjYWxsZWQgdmlhIFtbVlJNLnVwZGF0ZV1dIHNvIHlvdSBkb24ndCBoYXZlIHRvIGNhbGwgdGhpcyBtYW51YWxseS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWUgc2luY2UgbGFzdCB1cGRhdGVcclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlVlJNTWF0ZXJpYWxzKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuX3V2QW5pbU9mZnNldFggPSB0aGlzLl91dkFuaW1PZmZzZXRYICsgZGVsdGEgKiB0aGlzLnV2QW5pbVNjcm9sbFg7XHJcbiAgICB0aGlzLl91dkFuaW1PZmZzZXRZID0gdGhpcy5fdXZBbmltT2Zmc2V0WSAtIGRlbHRhICogdGhpcy51dkFuaW1TY3JvbGxZOyAvLyBOZWdhdGl2ZSBzaW5jZSB0IGF4aXMgb2YgdXZzIGFyZSBvcHBvc2l0ZSBmcm9tIFVuaXR5J3Mgb25lXHJcbiAgICB0aGlzLl91dkFuaW1QaGFzZSA9IHRoaXMuX3V2QW5pbVBoYXNlICsgZGVsdGEgKiB0aGlzLnV2QW5pbVJvdGF0aW9uO1xyXG5cclxuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogdGhpcyk6IHRoaXMge1xyXG4gICAgc3VwZXIuY29weShzb3VyY2UpO1xyXG5cclxuICAgIC8vID09IGNvcHkgbWVtYmVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMuY3V0b2ZmID0gc291cmNlLmN1dG9mZjtcclxuICAgIHRoaXMuY29sb3IuY29weShzb3VyY2UuY29sb3IpO1xyXG4gICAgdGhpcy5zaGFkZUNvbG9yLmNvcHkoc291cmNlLnNoYWRlQ29sb3IpO1xyXG4gICAgdGhpcy5tYXAgPSBzb3VyY2UubWFwO1xyXG4gICAgdGhpcy5tYWluVGV4X1NULmNvcHkoc291cmNlLm1haW5UZXhfU1QpO1xyXG4gICAgdGhpcy5zaGFkZVRleHR1cmUgPSBzb3VyY2Uuc2hhZGVUZXh0dXJlO1xyXG4gICAgdGhpcy5ub3JtYWxNYXAgPSBzb3VyY2Uubm9ybWFsTWFwO1xyXG4gICAgdGhpcy5ub3JtYWxNYXBUeXBlID0gc291cmNlLm5vcm1hbE1hcFR5cGU7XHJcbiAgICB0aGlzLm5vcm1hbFNjYWxlLmNvcHkodGhpcy5ub3JtYWxTY2FsZSk7XHJcbiAgICB0aGlzLnJlY2VpdmVTaGFkb3dSYXRlID0gc291cmNlLnJlY2VpdmVTaGFkb3dSYXRlO1xyXG4gICAgdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSA9IHNvdXJjZS5yZWNlaXZlU2hhZG93VGV4dHVyZTtcclxuICAgIHRoaXMuc2hhZGluZ0dyYWRlUmF0ZSA9IHNvdXJjZS5zaGFkaW5nR3JhZGVSYXRlO1xyXG4gICAgdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlID0gc291cmNlLnNoYWRpbmdHcmFkZVRleHR1cmU7XHJcbiAgICB0aGlzLnNoYWRlU2hpZnQgPSBzb3VyY2Uuc2hhZGVTaGlmdDtcclxuICAgIHRoaXMuc2hhZGVUb29ueSA9IHNvdXJjZS5zaGFkZVRvb255O1xyXG4gICAgdGhpcy5saWdodENvbG9yQXR0ZW51YXRpb24gPSBzb3VyY2UubGlnaHRDb2xvckF0dGVudWF0aW9uO1xyXG4gICAgdGhpcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5ID0gc291cmNlLmluZGlyZWN0TGlnaHRJbnRlbnNpdHk7XHJcbiAgICB0aGlzLnJpbVRleHR1cmUgPSBzb3VyY2UucmltVGV4dHVyZTtcclxuICAgIHRoaXMucmltQ29sb3IuY29weShzb3VyY2UucmltQ29sb3IpO1xyXG4gICAgdGhpcy5yaW1MaWdodGluZ01peCA9IHNvdXJjZS5yaW1MaWdodGluZ01peDtcclxuICAgIHRoaXMucmltRnJlc25lbFBvd2VyID0gc291cmNlLnJpbUZyZXNuZWxQb3dlcjtcclxuICAgIHRoaXMucmltTGlmdCA9IHNvdXJjZS5yaW1MaWZ0O1xyXG4gICAgdGhpcy5zcGhlcmVBZGQgPSBzb3VyY2Uuc3BoZXJlQWRkO1xyXG4gICAgdGhpcy5lbWlzc2lvbkNvbG9yLmNvcHkoc291cmNlLmVtaXNzaW9uQ29sb3IpO1xyXG4gICAgdGhpcy5lbWlzc2l2ZU1hcCA9IHNvdXJjZS5lbWlzc2l2ZU1hcDtcclxuICAgIHRoaXMub3V0bGluZVdpZHRoVGV4dHVyZSA9IHNvdXJjZS5vdXRsaW5lV2lkdGhUZXh0dXJlO1xyXG4gICAgdGhpcy5vdXRsaW5lV2lkdGggPSBzb3VyY2Uub3V0bGluZVdpZHRoO1xyXG4gICAgdGhpcy5vdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UgPSBzb3VyY2Uub3V0bGluZVNjYWxlZE1heERpc3RhbmNlO1xyXG4gICAgdGhpcy5vdXRsaW5lQ29sb3IuY29weShzb3VyY2Uub3V0bGluZUNvbG9yKTtcclxuICAgIHRoaXMub3V0bGluZUxpZ2h0aW5nTWl4ID0gc291cmNlLm91dGxpbmVMaWdodGluZ01peDtcclxuICAgIHRoaXMudXZBbmltTWFza1RleHR1cmUgPSBzb3VyY2UudXZBbmltTWFza1RleHR1cmU7XHJcbiAgICB0aGlzLnV2QW5pbVNjcm9sbFggPSBzb3VyY2UudXZBbmltU2Nyb2xsWDtcclxuICAgIHRoaXMudXZBbmltU2Nyb2xsWSA9IHNvdXJjZS51dkFuaW1TY3JvbGxZO1xyXG4gICAgdGhpcy51dkFuaW1Sb3RhdGlvbiA9IHNvdXJjZS51dkFuaW1Sb3RhdGlvbjtcclxuXHJcbiAgICB0aGlzLmRlYnVnTW9kZSA9IHNvdXJjZS5kZWJ1Z01vZGU7XHJcbiAgICB0aGlzLmJsZW5kTW9kZSA9IHNvdXJjZS5ibGVuZE1vZGU7XHJcbiAgICB0aGlzLm91dGxpbmVXaWR0aE1vZGUgPSBzb3VyY2Uub3V0bGluZVdpZHRoTW9kZTtcclxuICAgIHRoaXMub3V0bGluZUNvbG9yTW9kZSA9IHNvdXJjZS5vdXRsaW5lQ29sb3JNb2RlO1xyXG4gICAgdGhpcy5jdWxsTW9kZSA9IHNvdXJjZS5jdWxsTW9kZTtcclxuICAgIHRoaXMub3V0bGluZUN1bGxNb2RlID0gc291cmNlLm91dGxpbmVDdWxsTW9kZTtcclxuXHJcbiAgICB0aGlzLmlzT3V0bGluZSA9IHNvdXJjZS5pc091dGxpbmU7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBcHBseSB1cGRhdGVkIHVuaWZvcm0gdmFyaWFibGVzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2FwcGx5VW5pZm9ybXMoKTogdm9pZCB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbU9mZnNldFgudmFsdWUgPSB0aGlzLl91dkFuaW1PZmZzZXRYO1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1PZmZzZXRZLnZhbHVlID0gdGhpcy5fdXZBbmltT2Zmc2V0WTtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltVGhldGEudmFsdWUgPSBUQVUgKiB0aGlzLl91dkFuaW1QaGFzZTtcclxuXHJcbiAgICBpZiAoIXRoaXMuc2hvdWxkQXBwbHlVbmlmb3Jtcykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLnNob3VsZEFwcGx5VW5pZm9ybXMgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLnVuaWZvcm1zLmN1dG9mZi52YWx1ZSA9IHRoaXMuY3V0b2ZmO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5jb2xvci52YWx1ZS5zZXRSR0IodGhpcy5jb2xvci54LCB0aGlzLmNvbG9yLnksIHRoaXMuY29sb3Iueik7XHJcbiAgICB0aGlzLnVuaWZvcm1zLmNvbG9yQWxwaGEudmFsdWUgPSB0aGlzLmNvbG9yLnc7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlQ29sb3IudmFsdWUuc2V0UkdCKHRoaXMuc2hhZGVDb2xvci54LCB0aGlzLnNoYWRlQ29sb3IueSwgdGhpcy5zaGFkZUNvbG9yLnopO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5tYXAudmFsdWUgPSB0aGlzLm1hcDtcclxuICAgIHRoaXMudW5pZm9ybXMubWFpblRleF9TVC52YWx1ZS5jb3B5KHRoaXMubWFpblRleF9TVCk7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlVGV4dHVyZS52YWx1ZSA9IHRoaXMuc2hhZGVUZXh0dXJlO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5ub3JtYWxNYXAudmFsdWUgPSB0aGlzLm5vcm1hbE1hcDtcclxuICAgIHRoaXMudW5pZm9ybXMubm9ybWFsU2NhbGUudmFsdWUuY29weSh0aGlzLm5vcm1hbFNjYWxlKTtcclxuICAgIHRoaXMudW5pZm9ybXMucmVjZWl2ZVNoYWRvd1JhdGUudmFsdWUgPSB0aGlzLnJlY2VpdmVTaGFkb3dSYXRlO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5yZWNlaXZlU2hhZG93VGV4dHVyZS52YWx1ZSA9IHRoaXMucmVjZWl2ZVNoYWRvd1RleHR1cmU7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRpbmdHcmFkZVJhdGUudmFsdWUgPSB0aGlzLnNoYWRpbmdHcmFkZVJhdGU7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRpbmdHcmFkZVRleHR1cmUudmFsdWUgPSB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmU7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlU2hpZnQudmFsdWUgPSB0aGlzLnNoYWRlU2hpZnQ7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlVG9vbnkudmFsdWUgPSB0aGlzLnNoYWRlVG9vbnk7XHJcbiAgICB0aGlzLnVuaWZvcm1zLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbi52YWx1ZSA9IHRoaXMubGlnaHRDb2xvckF0dGVudWF0aW9uO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5LnZhbHVlID0gdGhpcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5O1xyXG4gICAgdGhpcy51bmlmb3Jtcy5yaW1UZXh0dXJlLnZhbHVlID0gdGhpcy5yaW1UZXh0dXJlO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5yaW1Db2xvci52YWx1ZS5zZXRSR0IodGhpcy5yaW1Db2xvci54LCB0aGlzLnJpbUNvbG9yLnksIHRoaXMucmltQ29sb3Iueik7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUxpZ2h0aW5nTWl4LnZhbHVlID0gdGhpcy5yaW1MaWdodGluZ01peDtcclxuICAgIHRoaXMudW5pZm9ybXMucmltRnJlc25lbFBvd2VyLnZhbHVlID0gdGhpcy5yaW1GcmVzbmVsUG93ZXI7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUxpZnQudmFsdWUgPSB0aGlzLnJpbUxpZnQ7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNwaGVyZUFkZC52YWx1ZSA9IHRoaXMuc3BoZXJlQWRkO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2lvbkNvbG9yLnZhbHVlLnNldFJHQih0aGlzLmVtaXNzaW9uQ29sb3IueCwgdGhpcy5lbWlzc2lvbkNvbG9yLnksIHRoaXMuZW1pc3Npb25Db2xvci56KTtcclxuICAgIHRoaXMudW5pZm9ybXMuZW1pc3NpdmVNYXAudmFsdWUgPSB0aGlzLmVtaXNzaXZlTWFwO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGhUZXh0dXJlLnZhbHVlID0gdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGgudmFsdWUgPSB0aGlzLm91dGxpbmVXaWR0aDtcclxuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZVNjYWxlZE1heERpc3RhbmNlLnZhbHVlID0gdGhpcy5vdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvci52YWx1ZS5zZXRSR0IodGhpcy5vdXRsaW5lQ29sb3IueCwgdGhpcy5vdXRsaW5lQ29sb3IueSwgdGhpcy5vdXRsaW5lQ29sb3Iueik7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVMaWdodGluZ01peC52YWx1ZSA9IHRoaXMub3V0bGluZUxpZ2h0aW5nTWl4O1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1NYXNrVGV4dHVyZS52YWx1ZSA9IHRoaXMudXZBbmltTWFza1RleHR1cmU7XHJcblxyXG4gICAgLy8gYXBwbHkgY29sb3Igc3BhY2UgdG8gdW5pZm9ybSBjb2xvcnNcclxuICAgIGlmICh0aGlzLmVuY29kaW5nID09PSBUSFJFRS5zUkdCRW5jb2RpbmcpIHtcclxuICAgICAgdGhpcy51bmlmb3Jtcy5jb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XHJcbiAgICAgIHRoaXMudW5pZm9ybXMuc2hhZGVDb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XHJcbiAgICAgIHRoaXMudW5pZm9ybXMucmltQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xyXG4gICAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaW9uQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xyXG4gICAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3VwZGF0ZVNoYWRlckNvZGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCB1c2VVdkluVmVydCA9IHRoaXMub3V0bGluZVdpZHRoVGV4dHVyZSAhPT0gbnVsbDtcclxuICAgIGNvbnN0IHVzZVV2SW5GcmFnID1cclxuICAgICAgdGhpcy5tYXAgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy5zaGFkZVRleHR1cmUgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSAhPT0gbnVsbCB8fFxyXG4gICAgICB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy5yaW1UZXh0dXJlICE9PSBudWxsIHx8XHJcbiAgICAgIHRoaXMudXZBbmltTWFza1RleHR1cmUgIT09IG51bGw7XHJcblxyXG4gICAgdGhpcy5kZWZpbmVzID0ge1xyXG4gICAgICAvLyBUZW1wb3JhcnkgY29tcGF0IGFnYWluc3Qgc2hhZGVyIGNoYW5nZSBAIFRocmVlLmpzIHIxMjZcclxuICAgICAgLy8gU2VlOiAjMjEyMDUsICMyMTMwNywgIzIxMjk5XHJcbiAgICAgIFRIUkVFX1ZSTV9USFJFRV9SRVZJU0lPTl8xMjY6IHBhcnNlSW50KFRIUkVFLlJFVklTSU9OKSA+PSAxMjYsXHJcblxyXG4gICAgICBPVVRMSU5FOiB0aGlzLl9pc091dGxpbmUsXHJcbiAgICAgIEJMRU5ETU9ERV9PUEFRVUU6IHRoaXMuX2JsZW5kTW9kZSA9PT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuT3BhcXVlLFxyXG4gICAgICBCTEVORE1PREVfQ1VUT1VUOiB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLkN1dG91dCxcclxuICAgICAgQkxFTkRNT0RFX1RSQU5TUEFSRU5UOlxyXG4gICAgICAgIHRoaXMuX2JsZW5kTW9kZSA9PT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuVHJhbnNwYXJlbnQgfHxcclxuICAgICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZSxcclxuICAgICAgTVRPT05fVVNFX1VWOiB1c2VVdkluVmVydCB8fCB1c2VVdkluRnJhZywgLy8gd2UgY2FuJ3QgdXNlIGBVU0VfVVZgICwgaXQgd2lsbCBiZSByZWRlZmluZWQgaW4gV2ViR0xQcm9ncmFtLmpzXHJcbiAgICAgIE1UT09OX1VWU19WRVJURVhfT05MWTogdXNlVXZJblZlcnQgJiYgIXVzZVV2SW5GcmFnLFxyXG4gICAgICBVU0VfU0hBREVURVhUVVJFOiB0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbCxcclxuICAgICAgVVNFX1JFQ0VJVkVTSEFET1dURVhUVVJFOiB0aGlzLnJlY2VpdmVTaGFkb3dUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfU0hBRElOR0dSQURFVEVYVFVSRTogdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfUklNVEVYVFVSRTogdGhpcy5yaW1UZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfU1BIRVJFQUREOiB0aGlzLnNwaGVyZUFkZCAhPT0gbnVsbCxcclxuICAgICAgVVNFX09VVExJTkVXSURUSFRFWFRVUkU6IHRoaXMub3V0bGluZVdpZHRoVGV4dHVyZSAhPT0gbnVsbCxcclxuICAgICAgVVNFX1VWQU5JTU1BU0tURVhUVVJFOiB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBERUJVR19OT1JNQUw6IHRoaXMuX2RlYnVnTW9kZSA9PT0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5Ob3JtYWwsXHJcbiAgICAgIERFQlVHX0xJVFNIQURFUkFURTogdGhpcy5fZGVidWdNb2RlID09PSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlLkxpdFNoYWRlUmF0ZSxcclxuICAgICAgREVCVUdfVVY6IHRoaXMuX2RlYnVnTW9kZSA9PT0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5VVixcclxuICAgICAgT1VUTElORV9XSURUSF9XT1JMRDogdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuV29ybGRDb29yZGluYXRlcyxcclxuICAgICAgT1VUTElORV9XSURUSF9TQ1JFRU46IHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLlNjcmVlbkNvb3JkaW5hdGVzLFxyXG4gICAgICBPVVRMSU5FX0NPTE9SX0ZJWEVEOiB0aGlzLl9vdXRsaW5lQ29sb3JNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZS5GaXhlZENvbG9yLFxyXG4gICAgICBPVVRMSU5FX0NPTE9SX01JWEVEOiB0aGlzLl9vdXRsaW5lQ29sb3JNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZS5NaXhlZExpZ2h0aW5nLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyA9PSB0ZXh0dXJlIGVuY29kaW5ncyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBlbmNvZGluZ3MgPVxyXG4gICAgICAodGhpcy5zaGFkZVRleHR1cmUgIT09IG51bGxcclxuICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbignc2hhZGVUZXh0dXJlVGV4ZWxUb0xpbmVhcicsIHRoaXMuc2hhZGVUZXh0dXJlLmVuY29kaW5nKSArICdcXG4nXHJcbiAgICAgICAgOiAnJykgK1xyXG4gICAgICAodGhpcy5zcGhlcmVBZGQgIT09IG51bGxcclxuICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbignc3BoZXJlQWRkVGV4ZWxUb0xpbmVhcicsIHRoaXMuc3BoZXJlQWRkLmVuY29kaW5nKSArICdcXG4nXHJcbiAgICAgICAgOiAnJykgK1xyXG4gICAgICAodGhpcy5yaW1UZXh0dXJlICE9PSBudWxsXHJcbiAgICAgICAgPyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24oJ3JpbVRleHR1cmVUZXhlbFRvTGluZWFyJywgdGhpcy5yaW1UZXh0dXJlLmVuY29kaW5nKSArICdcXG4nXHJcbiAgICAgICAgOiAnJyk7XHJcblxyXG4gICAgLy8gPT0gZ2VuZXJhdGUgc2hhZGVyIGNvZGUgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgdGhpcy52ZXJ0ZXhTaGFkZXIgPSB2ZXJ0ZXhTaGFkZXI7XHJcbiAgICB0aGlzLmZyYWdtZW50U2hhZGVyID0gZW5jb2RpbmdzICsgZnJhZ21lbnRTaGFkZXI7XHJcblxyXG4gICAgLy8gPT0gc2V0IG5lZWRzVXBkYXRlIGZsYWcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF91cGRhdGVDdWxsRmFjZSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc091dGxpbmUpIHtcclxuICAgICAgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5PZmYpIHtcclxuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Eb3VibGVTaWRlO1xyXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5Gcm9udCkge1xyXG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkJhY2tTaWRlO1xyXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5CYWNrKSB7XHJcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuRnJvbnRTaWRlO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAodGhpcy5vdXRsaW5lQ3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5PZmYpIHtcclxuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Eb3VibGVTaWRlO1xyXG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcclxuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5CYWNrU2lkZTtcclxuICAgICAgfSBlbHNlIGlmICh0aGlzLm91dGxpbmVDdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkJhY2spIHtcclxuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Gcm9udFNpZGU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwiLyogdHNsaW50OmRpc2FibGU6bWVtYmVyLW9yZGVyaW5nICovXHJcblxyXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB2ZXJ0ZXhTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL3VubGl0LnZlcnQnO1xyXG5pbXBvcnQgZnJhZ21lbnRTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL3VubGl0LmZyYWcnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBWUk1VbmxpdE1hdGVyaWFsUGFyYW1ldGVycyBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsUGFyYW1ldGVycyB7XHJcbiAgY3V0b2ZmPzogbnVtYmVyOyAvLyBfQ3V0b2ZmXHJcbiAgbWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX01haW5UZXhcclxuICBtYWluVGV4PzogVEhSRUUuVGV4dHVyZTsgLy8gX01haW5UZXggKHdpbGwgYmUgcmVuYW1lZCB0byBtYXApXHJcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxyXG4gIG1haW5UZXhfU1Q/OiBUSFJFRS5WZWN0b3I0OyAvLyBfTWFpblRleF9TVFxyXG5cclxuICByZW5kZXJUeXBlPzogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUgfCBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBlbnVtIFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIHtcclxuICBPcGFxdWUsXHJcbiAgQ3V0b3V0LFxyXG4gIFRyYW5zcGFyZW50LFxyXG4gIFRyYW5zcGFyZW50V2l0aFpXcml0ZSxcclxufVxyXG5cclxuLyoqXHJcbiAqIFRoaXMgaXMgYSBtYXRlcmlhbCB0aGF0IGlzIGFuIGVxdWl2YWxlbnQgb2YgXCJWUk0vVW5saXQqKipcIiBvbiBWUk0gc3BlYywgdGhvc2UgbWF0ZXJpYWxzIGFyZSBhbHJlYWR5IGtpbmRhIGRlcHJlY2F0ZWQgdGhvdWdoLi4uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNVW5saXRNYXRlcmlhbCBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsIHtcclxuICAvKipcclxuICAgKiBSZWFkb25seSBib29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoaXMgaXMgYSBbW1ZSTVVubGl0TWF0ZXJpYWxdXS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaXNWUk1VbmxpdE1hdGVyaWFsOiBib29sZWFuID0gdHJ1ZTtcclxuXHJcbiAgcHVibGljIGN1dG9mZiA9IDAuNTtcclxuICBwdWJsaWMgbWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9NYWluVGV4XHJcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxyXG4gIHB1YmxpYyBtYWluVGV4X1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX01haW5UZXhfU1RcclxuICBwcml2YXRlIF9yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuT3BhcXVlO1xyXG5cclxuICBwdWJsaWMgc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7IC8vIHdoZW4gdGhpcyBpcyB0cnVlLCBhcHBseVVuaWZvcm1zIGVmZmVjdHNcclxuXHJcbiAgY29uc3RydWN0b3IocGFyYW1ldGVycz86IFZSTVVubGl0TWF0ZXJpYWxQYXJhbWV0ZXJzKSB7XHJcbiAgICBzdXBlcigpO1xyXG5cclxuICAgIGlmIChwYXJhbWV0ZXJzID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgcGFyYW1ldGVycyA9IHt9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vID09IGVuYWJsaW5nIGJ1bmNoIG9mIHN0dWZmID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHBhcmFtZXRlcnMuZm9nID0gdHJ1ZTtcclxuICAgIHBhcmFtZXRlcnMuY2xpcHBpbmcgPSB0cnVlO1xyXG5cclxuICAgIHBhcmFtZXRlcnMuc2tpbm5pbmcgPSBwYXJhbWV0ZXJzLnNraW5uaW5nIHx8IGZhbHNlO1xyXG4gICAgcGFyYW1ldGVycy5tb3JwaFRhcmdldHMgPSBwYXJhbWV0ZXJzLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcclxuICAgIHBhcmFtZXRlcnMubW9ycGhOb3JtYWxzID0gcGFyYW1ldGVycy5tb3JwaE5vcm1hbHMgfHwgZmFsc2U7XHJcblxyXG4gICAgLy8gPT0gdW5pZm9ybXMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgcGFyYW1ldGVycy51bmlmb3JtcyA9IFRIUkVFLlVuaWZvcm1zVXRpbHMubWVyZ2UoW1xyXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5jb21tb24sIC8vIG1hcFxyXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXHJcbiAgICAgIHtcclxuICAgICAgICBjdXRvZmY6IHsgdmFsdWU6IDAuNSB9LFxyXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cclxuICAgICAgICBtYWluVGV4X1NUOiB7IHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdKTtcclxuXHJcbiAgICAvLyA9PSBmaW5hbGx5IGNvbXBpbGUgdGhlIHNoYWRlciBwcm9ncmFtID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLnNldFZhbHVlcyhwYXJhbWV0ZXJzKTtcclxuXHJcbiAgICAvLyA9PSB1cGRhdGUgc2hhZGVyIHN0dWZmID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XHJcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XHJcbiAgfVxyXG5cclxuICBnZXQgbWFpblRleCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5tYXA7XHJcbiAgfVxyXG5cclxuICBzZXQgbWFpblRleCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy5tYXAgPSB0O1xyXG4gIH1cclxuXHJcbiAgZ2V0IHJlbmRlclR5cGUoKTogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUge1xyXG4gICAgcmV0dXJuIHRoaXMuX3JlbmRlclR5cGU7XHJcbiAgfVxyXG5cclxuICBzZXQgcmVuZGVyVHlwZSh0OiBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSkge1xyXG4gICAgdGhpcy5fcmVuZGVyVHlwZSA9IHQ7XHJcblxyXG4gICAgdGhpcy5kZXB0aFdyaXRlID0gdGhpcy5fcmVuZGVyVHlwZSAhPT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQ7XHJcbiAgICB0aGlzLnRyYW5zcGFyZW50ID1cclxuICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQgfHxcclxuICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnRXaXRoWldyaXRlO1xyXG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoaXMgbWF0ZXJpYWwuXHJcbiAgICogVXN1YWxseSB0aGlzIHdpbGwgYmUgY2FsbGVkIHZpYSBbW1ZSTS51cGRhdGVdXSBzbyB5b3UgZG9uJ3QgaGF2ZSB0byBjYWxsIHRoaXMgbWFudWFsbHkuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lIHNpbmNlIGxhc3QgdXBkYXRlXHJcbiAgICovXHJcbiAgcHVibGljIHVwZGF0ZVZSTU1hdGVyaWFscyhkZWx0YTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY29weShzb3VyY2U6IHRoaXMpOiB0aGlzIHtcclxuICAgIHN1cGVyLmNvcHkoc291cmNlKTtcclxuXHJcbiAgICAvLyA9PSBjb3B5IG1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLmN1dG9mZiA9IHNvdXJjZS5jdXRvZmY7XHJcbiAgICB0aGlzLm1hcCA9IHNvdXJjZS5tYXA7XHJcbiAgICB0aGlzLm1haW5UZXhfU1QuY29weShzb3VyY2UubWFpblRleF9TVCk7XHJcbiAgICB0aGlzLnJlbmRlclR5cGUgPSBzb3VyY2UucmVuZGVyVHlwZTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFwcGx5IHVwZGF0ZWQgdW5pZm9ybSB2YXJpYWJsZXMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfYXBwbHlVbmlmb3JtcygpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5zaG91bGRBcHBseVVuaWZvcm1zKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMudW5pZm9ybXMuY3V0b2ZmLnZhbHVlID0gdGhpcy5jdXRvZmY7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm1hcC52YWx1ZSA9IHRoaXMubWFwO1xyXG4gICAgdGhpcy51bmlmb3Jtcy5tYWluVGV4X1NULnZhbHVlLmNvcHkodGhpcy5tYWluVGV4X1NUKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3VwZGF0ZVNoYWRlckNvZGUoKTogdm9pZCB7XHJcbiAgICB0aGlzLmRlZmluZXMgPSB7XHJcbiAgICAgIFJFTkRFUlRZUEVfT1BBUVVFOiB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5PcGFxdWUsXHJcbiAgICAgIFJFTkRFUlRZUEVfQ1VUT1VUOiB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5DdXRvdXQsXHJcbiAgICAgIFJFTkRFUlRZUEVfVFJBTlNQQVJFTlQ6XHJcbiAgICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQgfHxcclxuICAgICAgICB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudFdpdGhaV3JpdGUsXHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMudmVydGV4U2hhZGVyID0gdmVydGV4U2hhZGVyO1xyXG4gICAgdGhpcy5mcmFnbWVudFNoYWRlciA9IGZyYWdtZW50U2hhZGVyO1xyXG5cclxuICAgIC8vID09IHNldCBuZWVkc1VwZGF0ZSBmbGFnID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcclxuaW1wb3J0IHsgR0xURlNjaGVtYSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XHJcbmltcG9ydCB7IE1Ub29uTWF0ZXJpYWwsIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsJztcclxuaW1wb3J0IHsgVlJNVW5saXRNYXRlcmlhbCwgVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUgfSBmcm9tICcuL1ZSTVVubGl0TWF0ZXJpYWwnO1xyXG5cclxuLyoqXHJcbiAqIE9wdGlvbnMgZm9yIGEgW1tWUk1NYXRlcmlhbEltcG9ydGVyXV0gaW5zdGFuY2UuXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFZSTU1hdGVyaWFsSW1wb3J0ZXJPcHRpb25zIHtcclxuICAvKipcclxuICAgKiBTcGVjaWZ5IHRoZSBlbmNvZGluZyBvZiBpbnB1dCB1bmlmb3JtIGNvbG9ycyBhbmQgdGV4dHVyZXMuXHJcbiAgICpcclxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYC5cclxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuc1JHQkVuY29kaW5nYCwgdXNlIGBUSFJFRS5zUkdCRW5jb2RpbmdgLlxyXG4gICAqXHJcbiAgICogVGhlIGltcG9ydGVyIHdpbGwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AgaWYgdGhpcyBvcHRpb24gaXNuJ3Qgc3BlY2lmaWVkLlxyXG4gICAqXHJcbiAgICogU2VlIGFsc286IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL3JlbmRlcmVycy9XZWJHTFJlbmRlcmVyLm91dHB1dEVuY29kaW5nXHJcbiAgICovXHJcbiAgZW5jb2Rpbmc/OiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYFByb21pc2VgIG9mIGVudmlyb25tZW50IG1hcCB0ZXh0dXJlLlxyXG4gICAqIFRoZSBpbXBvcnRlciB3aWxsIGF0dGVtcHQgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIHdoZW4gaXQgaGF2ZSB0byB1c2UgYW4gZW52bWFwLlxyXG4gICAqL1xyXG4gIHJlcXVlc3RFbnZNYXA/OiAoKSA9PiBQcm9taXNlPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBWUk0gbWF0ZXJpYWxzIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1NYXRlcmlhbEltcG9ydGVyIHtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9lbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX3JlcXVlc3RFbnZNYXA/OiAoKSA9PiBQcm9taXNlPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFZSTU1hdGVyaWFsSW1wb3J0ZXIuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIG9mIHRoZSBWUk1NYXRlcmlhbEltcG9ydGVyXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3Iob3B0aW9uczogVlJNTWF0ZXJpYWxJbXBvcnRlck9wdGlvbnMgPSB7fSkge1xyXG4gICAgdGhpcy5fZW5jb2RpbmcgPSBvcHRpb25zLmVuY29kaW5nIHx8IFRIUkVFLkxpbmVhckVuY29kaW5nO1xyXG4gICAgaWYgKHRoaXMuX2VuY29kaW5nICE9PSBUSFJFRS5MaW5lYXJFbmNvZGluZyAmJiB0aGlzLl9lbmNvZGluZyAhPT0gVEhSRUUuc1JHQkVuY29kaW5nKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICAnVGhlIHNwZWNpZmllZCBjb2xvciBlbmNvZGluZyBtaWdodCBub3Qgd29yayBwcm9wZXJseSB3aXRoIFZSTU1hdGVyaWFsSW1wb3J0ZXIuIFlvdSBtaWdodCB3YW50IHRvIHVzZSBUSFJFRS5zUkdCRW5jb2RpbmcgaW5zdGVhZC4nLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3JlcXVlc3RFbnZNYXAgPSBvcHRpb25zLnJlcXVlc3RFbnZNYXA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IGFsbCB0aGUgbWF0ZXJpYWxzIG9mIGdpdmVuIEdMVEYgYmFzZWQgb24gVlJNIGV4dGVuc2lvbiBmaWVsZCBgbWF0ZXJpYWxQcm9wZXJ0aWVzYC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBjb252ZXJ0R0xURk1hdGVyaWFscyhnbHRmOiBHTFRGKTogUHJvbWlzZTxUSFJFRS5NYXRlcmlhbFtdIHwgbnVsbD4ge1xyXG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XHJcbiAgICBpZiAoIXZybUV4dCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtYXRlcmlhbFByb3BlcnRpZXM6IFZSTVNjaGVtYS5NYXRlcmlhbFtdIHwgdW5kZWZpbmVkID0gdnJtRXh0Lm1hdGVyaWFsUHJvcGVydGllcztcclxuICAgIGlmICghbWF0ZXJpYWxQcm9wZXJ0aWVzKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5vZGVQcmltaXRpdmVzTWFwID0gYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGYpO1xyXG4gICAgY29uc3QgbWF0ZXJpYWxMaXN0OiB7IFt2cm1NYXRlcmlhbEluZGV4OiBudW1iZXJdOiB7IHN1cmZhY2U6IFRIUkVFLk1hdGVyaWFsOyBvdXRsaW5lPzogVEhSRUUuTWF0ZXJpYWwgfSB9ID0ge307XHJcbiAgICBjb25zdCBtYXRlcmlhbHM6IFRIUkVFLk1hdGVyaWFsW10gPSBbXTsgLy8gcmVzdWx0XHJcblxyXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgIEFycmF5LmZyb20obm9kZVByaW1pdGl2ZXNNYXAuZW50cmllcygpKS5tYXAoYXN5bmMgKFtub2RlSW5kZXgsIHByaW1pdGl2ZXNdKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc2NoZW1hTm9kZTogR0xURlNjaGVtYS5Ob2RlID0gZ2x0Zi5wYXJzZXIuanNvbi5ub2Rlc1tub2RlSW5kZXhdO1xyXG4gICAgICAgIGNvbnN0IHNjaGVtYU1lc2g6IEdMVEZTY2hlbWEuTWVzaCA9IGdsdGYucGFyc2VyLmpzb24ubWVzaGVzW3NjaGVtYU5vZGUubWVzaCFdO1xyXG5cclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcclxuICAgICAgICAgIHByaW1pdGl2ZXMubWFwKGFzeW5jIChwcmltaXRpdmUsIHByaW1pdGl2ZUluZGV4KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNjaGVtYVByaW1pdGl2ZSA9IHNjaGVtYU1lc2gucHJpbWl0aXZlc1twcmltaXRpdmVJbmRleF07XHJcblxyXG4gICAgICAgICAgICAvLyBzb21lIGdsVEYgbWlnaHQgaGF2ZSBib3RoIGBub2RlLm1lc2hgIGFuZCBgbm9kZS5jaGlsZHJlbmAgYXQgb25jZVxyXG4gICAgICAgICAgICAvLyBhbmQgR0xURkxvYWRlciBoYW5kbGVzIGJvdGggbWVzaCBwcmltaXRpdmVzIGFuZCBcImNoaWxkcmVuXCIgaW4gZ2xURiBhcyBcImNoaWxkcmVuXCIgaW4gVEhSRUVcclxuICAgICAgICAgICAgLy8gSXQgc2VlbXMgR0xURkxvYWRlciBoYW5kbGVzIHByaW1pdGl2ZXMgZmlyc3QgdGhlbiBoYW5kbGVzIFwiY2hpbGRyZW5cIiBpbiBnbFRGIChpdCdzIGx1Y2t5ISlcclxuICAgICAgICAgICAgLy8gc28gd2Ugc2hvdWxkIGlnbm9yZSAocHJpbWl0aXZlcy5sZW5ndGgpdGggYW5kIGZvbGxvd2luZyBjaGlsZHJlbiBvZiBgbWVzaC5jaGlsZHJlbmBcclxuICAgICAgICAgICAgLy8gVE9ETzogc2FuaXRpemUgdGhpcyBhZnRlciBHTFRGTG9hZGVyIHBsdWdpbiBzeXN0ZW0gZ2V0cyBpbnRyb2R1Y2VkIDogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzE4NDIxXHJcbiAgICAgICAgICAgIGlmICghc2NoZW1hUHJpbWl0aXZlKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwcmltaXRpdmVHZW9tZXRyeSA9IHByaW1pdGl2ZS5nZW9tZXRyeTtcclxuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVmVydGljZXMgPSBwcmltaXRpdmVHZW9tZXRyeS5pbmRleFxyXG4gICAgICAgICAgICAgID8gcHJpbWl0aXZlR2VvbWV0cnkuaW5kZXguY291bnRcclxuICAgICAgICAgICAgICA6IHByaW1pdGl2ZUdlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb24uY291bnQgLyAzO1xyXG5cclxuICAgICAgICAgICAgLy8gaWYgcHJpbWl0aXZlcyBtYXRlcmlhbCBpcyBub3QgYW4gYXJyYXksIG1ha2UgaXQgYW4gYXJyYXlcclxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByaW1pdGl2ZS5tYXRlcmlhbCkpIHtcclxuICAgICAgICAgICAgICBwcmltaXRpdmUubWF0ZXJpYWwgPSBbcHJpbWl0aXZlLm1hdGVyaWFsXTtcclxuICAgICAgICAgICAgICBwcmltaXRpdmVHZW9tZXRyeS5hZGRHcm91cCgwLCBwcmltaXRpdmVWZXJ0aWNlcywgMCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZSAvIHB1c2ggdG8gY2FjaGUgKG9yIHBvcCBmcm9tIGNhY2hlKSB2cm0gbWF0ZXJpYWxzXHJcbiAgICAgICAgICAgIGNvbnN0IHZybU1hdGVyaWFsSW5kZXggPSBzY2hlbWFQcmltaXRpdmUubWF0ZXJpYWwhO1xyXG5cclxuICAgICAgICAgICAgbGV0IHByb3BzID0gbWF0ZXJpYWxQcm9wZXJ0aWVzW3ZybU1hdGVyaWFsSW5kZXhdO1xyXG4gICAgICAgICAgICBpZiAoIXByb3BzKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgICAgYFZSTU1hdGVyaWFsSW1wb3J0ZXI6IFRoZXJlIGFyZSBubyBtYXRlcmlhbCBkZWZpbml0aW9uIGZvciBtYXRlcmlhbCAjJHt2cm1NYXRlcmlhbEluZGV4fSBvbiBWUk0gZXh0ZW5zaW9uLmAsXHJcbiAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICBwcm9wcyA9IHsgc2hhZGVyOiAnVlJNX1VTRV9HTFRGU0hBREVSJyB9OyAvLyBmYWxsYmFja1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgdnJtTWF0ZXJpYWxzOiB7IHN1cmZhY2U6IFRIUkVFLk1hdGVyaWFsOyBvdXRsaW5lPzogVEhSRUUuTWF0ZXJpYWwgfTtcclxuICAgICAgICAgICAgaWYgKG1hdGVyaWFsTGlzdFt2cm1NYXRlcmlhbEluZGV4XSkge1xyXG4gICAgICAgICAgICAgIHZybU1hdGVyaWFscyA9IG1hdGVyaWFsTGlzdFt2cm1NYXRlcmlhbEluZGV4XTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMgPSBhd2FpdCB0aGlzLmNyZWF0ZVZSTU1hdGVyaWFscyhwcmltaXRpdmUubWF0ZXJpYWxbMF0sIHByb3BzLCBnbHRmKTtcclxuICAgICAgICAgICAgICBtYXRlcmlhbExpc3RbdnJtTWF0ZXJpYWxJbmRleF0gPSB2cm1NYXRlcmlhbHM7XHJcblxyXG4gICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKHZybU1hdGVyaWFscy5zdXJmYWNlKTtcclxuICAgICAgICAgICAgICBpZiAodnJtTWF0ZXJpYWxzLm91dGxpbmUpIHtcclxuICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKHZybU1hdGVyaWFscy5vdXRsaW5lKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIHN1cmZhY2VcclxuICAgICAgICAgICAgcHJpbWl0aXZlLm1hdGVyaWFsWzBdID0gdnJtTWF0ZXJpYWxzLnN1cmZhY2U7XHJcblxyXG4gICAgICAgICAgICAvLyBlbnZtYXBcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlcXVlc3RFbnZNYXAgJiYgKHZybU1hdGVyaWFscy5zdXJmYWNlIGFzIGFueSkuaXNNZXNoU3RhbmRhcmRNYXRlcmlhbCkge1xyXG4gICAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RFbnZNYXAoKS50aGVuKChlbnZNYXApID0+IHtcclxuICAgICAgICAgICAgICAgICh2cm1NYXRlcmlhbHMuc3VyZmFjZSBhcyBhbnkpLmVudk1hcCA9IGVudk1hcDtcclxuICAgICAgICAgICAgICAgIHZybU1hdGVyaWFscy5zdXJmYWNlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gcmVuZGVyIG9yZGVyXHJcbiAgICAgICAgICAgIHByaW1pdGl2ZS5yZW5kZXJPcmRlciA9IHByb3BzLnJlbmRlclF1ZXVlIHx8IDIwMDA7XHJcblxyXG4gICAgICAgICAgICAvLyBvdXRsaW5lIChcIjIgcGFzcyBzaGFkaW5nIHVzaW5nIGdyb3Vwc1wiIHRyaWNrIGhlcmUpXHJcbiAgICAgICAgICAgIGlmICh2cm1NYXRlcmlhbHMub3V0bGluZSkge1xyXG4gICAgICAgICAgICAgIHByaW1pdGl2ZS5tYXRlcmlhbFsxXSA9IHZybU1hdGVyaWFscy5vdXRsaW5lO1xyXG4gICAgICAgICAgICAgIHByaW1pdGl2ZUdlb21ldHJ5LmFkZEdyb3VwKDAsIHByaW1pdGl2ZVZlcnRpY2VzLCAxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgKTtcclxuICAgICAgfSksXHJcbiAgICApO1xyXG5cclxuICAgIHJldHVybiBtYXRlcmlhbHM7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgY3JlYXRlVlJNTWF0ZXJpYWxzKFxyXG4gICAgb3JpZ2luYWxNYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwsXHJcbiAgICB2cm1Qcm9wczogVlJNU2NoZW1hLk1hdGVyaWFsLFxyXG4gICAgZ2x0ZjogR0xURixcclxuICApOiBQcm9taXNlPHtcclxuICAgIHN1cmZhY2U6IFRIUkVFLk1hdGVyaWFsO1xyXG4gICAgb3V0bGluZT86IFRIUkVFLk1hdGVyaWFsO1xyXG4gIH0+IHtcclxuICAgIGxldCBuZXdTdXJmYWNlOiBUSFJFRS5NYXRlcmlhbCB8IHVuZGVmaW5lZDtcclxuICAgIGxldCBuZXdPdXRsaW5lOiBUSFJFRS5NYXRlcmlhbCB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL01Ub29uJykge1xyXG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcclxuXHJcbiAgICAgIC8vIHdlIG5lZWQgdG8gZ2V0IHJpZCBvZiB0aGVzZSBwcm9wZXJ0aWVzXHJcbiAgICAgIFsnc3JjQmxlbmQnLCAnZHN0QmxlbmQnLCAnaXNGaXJzdFNldHVwJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xyXG4gICAgICAgIGlmIChwYXJhbXNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgZGVsZXRlIHBhcmFtc1tuYW1lXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gdGhlc2UgdGV4dHVyZXMgbXVzdCBiZSBzUkdCIEVuY29kaW5nLCBkZXBlbmRzIG9uIGN1cnJlbnQgY29sb3JzcGFjZVxyXG4gICAgICBbJ21haW5UZXgnLCAnc2hhZGVUZXh0dXJlJywgJ2VtaXNzaW9uTWFwJywgJ3NwaGVyZUFkZCcsICdyaW1UZXh0dXJlJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xyXG4gICAgICAgIGlmIChwYXJhbXNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgcGFyYW1zW25hbWVdLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIHNwZWNpZnkgdW5pZm9ybSBjb2xvciBlbmNvZGluZ3NcclxuICAgICAgcGFyYW1zLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XHJcblxyXG4gICAgICAvLyBkb25lXHJcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgTVRvb25NYXRlcmlhbChwYXJhbXMpO1xyXG5cclxuICAgICAgLy8gb3V0bGluZVxyXG4gICAgICBpZiAocGFyYW1zLm91dGxpbmVXaWR0aE1vZGUgIT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLk5vbmUpIHtcclxuICAgICAgICBwYXJhbXMuaXNPdXRsaW5lID0gdHJ1ZTtcclxuICAgICAgICBuZXdPdXRsaW5lID0gbmV3IE1Ub29uTWF0ZXJpYWwocGFyYW1zKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRUZXh0dXJlJykge1xyXG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XHJcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xyXG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLk9wYXF1ZTtcclxuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XHJcbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdEN1dG91dCcpIHtcclxuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxyXG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcclxuICAgICAgcGFyYW1zLnJlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5DdXRvdXQ7XHJcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xyXG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRUcmFuc3BhcmVudCcpIHtcclxuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxyXG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcclxuICAgICAgcGFyYW1zLnJlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudDtcclxuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XHJcbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdFRyYW5zcGFyZW50WldyaXRlJykge1xyXG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XHJcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xyXG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcclxuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAodnJtUHJvcHMuc2hhZGVyICE9PSAnVlJNX1VTRV9HTFRGU0hBREVSJykge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihgVW5rbm93biBzaGFkZXIgZGV0ZWN0ZWQ6IFwiJHt2cm1Qcm9wcy5zaGFkZXJ9XCJgKTtcclxuICAgICAgICAvLyB0aGVuIHByZXN1bWUgYXMgVlJNX1VTRV9HTFRGU0hBREVSXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIG5ld1N1cmZhY2UgPSB0aGlzLl9jb252ZXJ0R0xURk1hdGVyaWFsKG9yaWdpbmFsTWF0ZXJpYWwuY2xvbmUoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgbmV3U3VyZmFjZS5uYW1lID0gb3JpZ2luYWxNYXRlcmlhbC5uYW1lO1xyXG4gICAgbmV3U3VyZmFjZS51c2VyRGF0YSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxNYXRlcmlhbC51c2VyRGF0YSkpO1xyXG4gICAgbmV3U3VyZmFjZS51c2VyRGF0YS52cm1NYXRlcmlhbFByb3BlcnRpZXMgPSB2cm1Qcm9wcztcclxuXHJcbiAgICBpZiAobmV3T3V0bGluZSkge1xyXG4gICAgICBuZXdPdXRsaW5lLm5hbWUgPSBvcmlnaW5hbE1hdGVyaWFsLm5hbWUgKyAnIChPdXRsaW5lKSc7XHJcbiAgICAgIG5ld091dGxpbmUudXNlckRhdGEgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsTWF0ZXJpYWwudXNlckRhdGEpKTtcclxuICAgICAgbmV3T3V0bGluZS51c2VyRGF0YS52cm1NYXRlcmlhbFByb3BlcnRpZXMgPSB2cm1Qcm9wcztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdXJmYWNlOiBuZXdTdXJmYWNlLFxyXG4gICAgICBvdXRsaW5lOiBuZXdPdXRsaW5lLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmIChuYW1lWzBdICE9PSAnXycpIHtcclxuICAgICAgY29uc29sZS53YXJuKGBWUk1NYXRlcmlhbHM6IEdpdmVuIHByb3BlcnR5IG5hbWUgXCIke25hbWV9XCIgbWlnaHQgYmUgaW52YWxpZGApO1xyXG4gICAgICByZXR1cm4gbmFtZTtcclxuICAgIH1cclxuICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcclxuXHJcbiAgICBpZiAoIS9bQS1aXS8udGVzdChuYW1lWzBdKSkge1xyXG4gICAgICBjb25zb2xlLndhcm4oYFZSTU1hdGVyaWFsczogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XHJcbiAgICAgIHJldHVybiBuYW1lO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5hbWVbMF0udG9Mb3dlckNhc2UoKSArIG5hbWUuc3Vic3RyaW5nKDEpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfY29udmVydEdMVEZNYXRlcmlhbChtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwpOiBUSFJFRS5NYXRlcmlhbCB7XHJcbiAgICBpZiAoKG1hdGVyaWFsIGFzIGFueSkuaXNNZXNoU3RhbmRhcmRNYXRlcmlhbCkge1xyXG4gICAgICBjb25zdCBtdGwgPSBtYXRlcmlhbCBhcyBUSFJFRS5NZXNoU3RhbmRhcmRNYXRlcmlhbDtcclxuXHJcbiAgICAgIGlmIChtdGwubWFwKSB7XHJcbiAgICAgICAgbXRsLm1hcC5lbmNvZGluZyA9IHRoaXMuX2VuY29kaW5nO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChtdGwuZW1pc3NpdmVNYXApIHtcclxuICAgICAgICBtdGwuZW1pc3NpdmVNYXAuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMuX2VuY29kaW5nID09PSBUSFJFRS5MaW5lYXJFbmNvZGluZykge1xyXG4gICAgICAgIG10bC5jb2xvci5jb252ZXJ0TGluZWFyVG9TUkdCKCk7XHJcbiAgICAgICAgbXRsLmVtaXNzaXZlLmNvbnZlcnRMaW5lYXJUb1NSR0IoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICgobWF0ZXJpYWwgYXMgYW55KS5pc01lc2hCYXNpY01hdGVyaWFsKSB7XHJcbiAgICAgIGNvbnN0IG10bCA9IG1hdGVyaWFsIGFzIFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsO1xyXG5cclxuICAgICAgaWYgKG10bC5tYXApIHtcclxuICAgICAgICBtdGwubWFwLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLl9lbmNvZGluZyA9PT0gVEhSRUUuTGluZWFyRW5jb2RpbmcpIHtcclxuICAgICAgICBtdGwuY29sb3IuY29udmVydExpbmVhclRvU1JHQigpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1hdGVyaWFsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhcclxuICAgIG9yaWdpbmFsTWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsLFxyXG4gICAgdnJtUHJvcHM6IFZSTVNjaGVtYS5NYXRlcmlhbCxcclxuICAgIGdsdGY6IEdMVEYsXHJcbiAgKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIGNvbnN0IHRhc2tMaXN0OiBBcnJheTxQcm9taXNlPGFueT4+ID0gW107XHJcbiAgICBjb25zdCBwYXJhbXM6IGFueSA9IHt9O1xyXG5cclxuICAgIC8vIGV4dHJhY3QgdGV4dHVyZSBwcm9wZXJ0aWVzXHJcbiAgICBpZiAodnJtUHJvcHMudGV4dHVyZVByb3BlcnRpZXMpIHtcclxuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKHZybVByb3BzLnRleHR1cmVQcm9wZXJ0aWVzKSkge1xyXG4gICAgICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLl9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWUpO1xyXG4gICAgICAgIGNvbnN0IHRleHR1cmVJbmRleCA9IHZybVByb3BzLnRleHR1cmVQcm9wZXJ0aWVzW25hbWVdO1xyXG5cclxuICAgICAgICB0YXNrTGlzdC5wdXNoKFxyXG4gICAgICAgICAgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgndGV4dHVyZScsIHRleHR1cmVJbmRleCkudGhlbigodGV4dHVyZTogVEhSRUUuVGV4dHVyZSkgPT4ge1xyXG4gICAgICAgICAgICBwYXJhbXNbbmV3TmFtZV0gPSB0ZXh0dXJlO1xyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGV4dHJhY3QgZmxvYXQgcHJvcGVydGllc1xyXG4gICAgaWYgKHZybVByb3BzLmZsb2F0UHJvcGVydGllcykge1xyXG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXModnJtUHJvcHMuZmxvYXRQcm9wZXJ0aWVzKSkge1xyXG4gICAgICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLl9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWUpO1xyXG4gICAgICAgIHBhcmFtc1tuZXdOYW1lXSA9IHZybVByb3BzLmZsb2F0UHJvcGVydGllc1tuYW1lXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGV4dHJhY3QgdmVjdG9yIChjb2xvciB0YmgpIHByb3BlcnRpZXNcclxuICAgIGlmICh2cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBPYmplY3Qua2V5cyh2cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzKSkge1xyXG4gICAgICAgIGxldCBuZXdOYW1lID0gdGhpcy5fcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lKTtcclxuXHJcbiAgICAgICAgLy8gaWYgdGhpcyBpcyB0ZXh0dXJlU1QgKHNhbWUgbmFtZSBhcyB0ZXh0dXJlIG5hbWUgaXRzZWxmKSwgYWRkICdfU1QnXHJcbiAgICAgICAgY29uc3QgaXNUZXh0dXJlU1QgPSBbXHJcbiAgICAgICAgICAnX01haW5UZXgnLFxyXG4gICAgICAgICAgJ19TaGFkZVRleHR1cmUnLFxyXG4gICAgICAgICAgJ19CdW1wTWFwJyxcclxuICAgICAgICAgICdfUmVjZWl2ZVNoYWRvd1RleHR1cmUnLFxyXG4gICAgICAgICAgJ19TaGFkaW5nR3JhZGVUZXh0dXJlJyxcclxuICAgICAgICAgICdfUmltVGV4dHVyZScsXHJcbiAgICAgICAgICAnX1NwaGVyZUFkZCcsXHJcbiAgICAgICAgICAnX0VtaXNzaW9uTWFwJyxcclxuICAgICAgICAgICdfT3V0bGluZVdpZHRoVGV4dHVyZScsXHJcbiAgICAgICAgICAnX1V2QW5pbU1hc2tUZXh0dXJlJyxcclxuICAgICAgICBdLnNvbWUoKHRleHR1cmVOYW1lKSA9PiBuYW1lID09PSB0ZXh0dXJlTmFtZSk7XHJcbiAgICAgICAgaWYgKGlzVGV4dHVyZVNUKSB7XHJcbiAgICAgICAgICBuZXdOYW1lICs9ICdfU1QnO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcGFyYW1zW25ld05hbWVdID0gbmV3IFRIUkVFLlZlY3RvcjQoLi4udnJtUHJvcHMudmVjdG9yUHJvcGVydGllc1tuYW1lXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBzZXQgd2hldGhlciBpdCBuZWVkcyBza2lubmluZyBhbmQgbW9ycGhpbmcgb3Igbm90XHJcbiAgICBwYXJhbXMuc2tpbm5pbmcgPSAob3JpZ2luYWxNYXRlcmlhbCBhcyBhbnkpLnNraW5uaW5nIHx8IGZhbHNlO1xyXG4gICAgcGFyYW1zLm1vcnBoVGFyZ2V0cyA9IChvcmlnaW5hbE1hdGVyaWFsIGFzIGFueSkubW9ycGhUYXJnZXRzIHx8IGZhbHNlO1xyXG4gICAgcGFyYW1zLm1vcnBoTm9ybWFscyA9IChvcmlnaW5hbE1hdGVyaWFsIGFzIGFueSkubW9ycGhOb3JtYWxzIHx8IGZhbHNlO1xyXG5cclxuICAgIHJldHVybiBQcm9taXNlLmFsbCh0YXNrTGlzdCkudGhlbigoKSA9PiBwYXJhbXMpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xyXG5pbXBvcnQgeyBWUk1NZXRhIH0gZnJvbSAnLi9WUk1NZXRhJztcclxuaW1wb3J0IHsgVlJNTWV0YUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4vVlJNTWV0YUltcG9ydGVyT3B0aW9ucyc7XHJcblxyXG4vKipcclxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEge0BsaW5rIFZSTU1ldGF9IGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1NZXRhSW1wb3J0ZXIge1xyXG4gIC8qKlxyXG4gICAqIElmIGB0cnVlYCwgaXQgd29uJ3QgbG9hZCBpdHMgdGh1bWJuYWlsIHRleHR1cmUgKHtAbGluayBWUk1NZXRhLnRleHR1cmV9KS4gYGZhbHNlYCBieSBkZWZhdWx0LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBpZ25vcmVUZXh0dXJlOiBib29sZWFuO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zPzogVlJNTWV0YUltcG9ydGVyT3B0aW9ucykge1xyXG4gICAgdGhpcy5pZ25vcmVUZXh0dXJlID0gb3B0aW9ucz8uaWdub3JlVGV4dHVyZSA/PyBmYWxzZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNTWV0YSB8IG51bGw+IHtcclxuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xyXG4gICAgaWYgKCF2cm1FeHQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hTWV0YTogVlJNU2NoZW1hLk1ldGEgfCB1bmRlZmluZWQgPSB2cm1FeHQubWV0YTtcclxuICAgIGlmICghc2NoZW1hTWV0YSkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgdGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgfCB1bmRlZmluZWQ7XHJcbiAgICBpZiAoIXRoaXMuaWdub3JlVGV4dHVyZSAmJiBzY2hlbWFNZXRhLnRleHR1cmUgIT0gbnVsbCAmJiBzY2hlbWFNZXRhLnRleHR1cmUgIT09IC0xKSB7XHJcbiAgICAgIHRleHR1cmUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCd0ZXh0dXJlJywgc2NoZW1hTWV0YS50ZXh0dXJlKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBhbGxvd2VkVXNlck5hbWU6IHNjaGVtYU1ldGEuYWxsb3dlZFVzZXJOYW1lLFxyXG4gICAgICBhdXRob3I6IHNjaGVtYU1ldGEuYXV0aG9yLFxyXG4gICAgICBjb21tZXJjaWFsVXNzYWdlTmFtZTogc2NoZW1hTWV0YS5jb21tZXJjaWFsVXNzYWdlTmFtZSxcclxuICAgICAgY29udGFjdEluZm9ybWF0aW9uOiBzY2hlbWFNZXRhLmNvbnRhY3RJbmZvcm1hdGlvbixcclxuICAgICAgbGljZW5zZU5hbWU6IHNjaGVtYU1ldGEubGljZW5zZU5hbWUsXHJcbiAgICAgIG90aGVyTGljZW5zZVVybDogc2NoZW1hTWV0YS5vdGhlckxpY2Vuc2VVcmwsXHJcbiAgICAgIG90aGVyUGVybWlzc2lvblVybDogc2NoZW1hTWV0YS5vdGhlclBlcm1pc3Npb25VcmwsXHJcbiAgICAgIHJlZmVyZW5jZTogc2NoZW1hTWV0YS5yZWZlcmVuY2UsXHJcbiAgICAgIHNleHVhbFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEuc2V4dWFsVXNzYWdlTmFtZSxcclxuICAgICAgdGV4dHVyZTogdGV4dHVyZSA/PyB1bmRlZmluZWQsXHJcbiAgICAgIHRpdGxlOiBzY2hlbWFNZXRhLnRpdGxlLFxyXG4gICAgICB2ZXJzaW9uOiBzY2hlbWFNZXRhLnZlcnNpb24sXHJcbiAgICAgIHZpb2xlbnRVc3NhZ2VOYW1lOiBzY2hlbWFNZXRhLnZpb2xlbnRVc3NhZ2VOYW1lLFxyXG4gICAgfTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuY29uc3QgX21hdEEgPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xyXG5cclxuLyoqXHJcbiAqIEEgY29tcGF0IGZ1bmN0aW9uIGZvciBgTWF0cml4NC5pbnZlcnQoKWAgLyBgTWF0cml4NC5nZXRJbnZlcnNlKClgLlxyXG4gKiBgTWF0cml4NC5pbnZlcnQoKWAgaXMgaW50cm9kdWNlZCBpbiByMTIzIGFuZCBgTWF0cml4NC5nZXRJbnZlcnNlKClgIGVtaXRzIGEgd2FybmluZy5cclxuICogV2UgYXJlIGdvaW5nIHRvIHVzZSB0aGlzIGNvbXBhdCBmb3IgYSB3aGlsZS5cclxuICogQHBhcmFtIHRhcmdldCBBIHRhcmdldCBtYXRyaXhcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtYXQ0SW52ZXJ0Q29tcGF0PFQgZXh0ZW5kcyBUSFJFRS5NYXRyaXg0Pih0YXJnZXQ6IFQpOiBUIHtcclxuICBpZiAoKHRhcmdldCBhcyBhbnkpLmludmVydCkge1xyXG4gICAgdGFyZ2V0LmludmVydCgpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAodGFyZ2V0IGFzIGFueSkuZ2V0SW52ZXJzZShfbWF0QS5jb3B5KHRhcmdldCkpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRhcmdldDtcclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IG1hdDRJbnZlcnRDb21wYXQgfSBmcm9tICcuL21hdDRJbnZlcnRDb21wYXQnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hdHJpeDRJbnZlcnNlQ2FjaGUge1xyXG4gIC8qKlxyXG4gICAqIFRoZSB0YXJnZXQgbWF0cml4LlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtYXRyaXg6IFRIUkVFLk1hdHJpeDQ7XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgY2FjaGUgb2YgaW52ZXJzZSBvZiBjdXJyZW50IG1hdHJpeC5cclxuICAgKi9cclxuICBwcml2YXRlIHJlYWRvbmx5IF9pbnZlcnNlQ2FjaGUgPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xyXG5cclxuICAvKipcclxuICAgKiBBIGZsYWcgdGhhdCBtYWtlcyBpdCB3YW50IHRvIHJlY2FsY3VsYXRlIGl0cyB7QGxpbmsgX2ludmVyc2VDYWNoZX0uXHJcbiAgICogV2lsbCBiZSBzZXQgYHRydWVgIHdoZW4gYGVsZW1lbnRzYCBhcmUgbXV0YXRlZCBhbmQgYmUgdXNlZCBpbiBgZ2V0SW52ZXJzZWAuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfc2hvdWxkVXBkYXRlSW52ZXJzZSA9IHRydWU7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBvcmlnaW5hbCBvZiBgbWF0cml4LmVsZW1lbnRzYFxyXG4gICAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRWxlbWVudHM6IG51bWJlcltdO1xyXG5cclxuICAvKipcclxuICAgKiBJbnZlcnNlIG9mIGdpdmVuIG1hdHJpeC5cclxuICAgKiBOb3RlIHRoYXQgaXQgd2lsbCByZXR1cm4gaXRzIGludGVybmFsIHByaXZhdGUgaW5zdGFuY2UuXHJcbiAgICogTWFrZSBzdXJlIGNvcHlpbmcgdGhpcyBiZWZvcmUgbXV0YXRlIHRoaXMuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBpbnZlcnNlKCk6IFRIUkVFLk1hdHJpeDQge1xyXG4gICAgaWYgKHRoaXMuX3Nob3VsZFVwZGF0ZUludmVyc2UpIHtcclxuICAgICAgbWF0NEludmVydENvbXBhdCh0aGlzLl9pbnZlcnNlQ2FjaGUuY29weSh0aGlzLm1hdHJpeCkpO1xyXG4gICAgICB0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlID0gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuX2ludmVyc2VDYWNoZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihtYXRyaXg6IFRIUkVFLk1hdHJpeDQpIHtcclxuICAgIHRoaXMubWF0cml4ID0gbWF0cml4O1xyXG5cclxuICAgIGNvbnN0IGhhbmRsZXI6IFByb3h5SGFuZGxlcjxudW1iZXJbXT4gPSB7XHJcbiAgICAgIHNldDogKG9iaiwgcHJvcDogbnVtYmVyLCBuZXdWYWwpID0+IHtcclxuICAgICAgICB0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlID0gdHJ1ZTtcclxuICAgICAgICBvYmpbcHJvcF0gPSBuZXdWYWw7XHJcblxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9LFxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLl9vcmlnaW5hbEVsZW1lbnRzID0gbWF0cml4LmVsZW1lbnRzO1xyXG4gICAgbWF0cml4LmVsZW1lbnRzID0gbmV3IFByb3h5KG1hdHJpeC5lbGVtZW50cywgaGFuZGxlcik7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgcmV2ZXJ0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5tYXRyaXguZWxlbWVudHMgPSB0aGlzLl9vcmlnaW5hbEVsZW1lbnRzO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IG1hdDRJbnZlcnRDb21wYXQgfSBmcm9tICcuLi91dGlscy9tYXQ0SW52ZXJ0Q29tcGF0JztcclxuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xyXG5pbXBvcnQgeyBNYXRyaXg0SW52ZXJzZUNhY2hlIH0gZnJvbSAnLi4vdXRpbHMvTWF0cml4NEludmVyc2VDYWNoZSc7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2ggfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzJztcclxuLy8gYmFzZWQgb25cclxuLy8gaHR0cDovL3JvY2tldGp1bXAuc2tyLmpwL3VuaXR5M2QvMTA5L1xyXG4vLyBodHRwczovL2dpdGh1Yi5jb20vZHdhbmdvL1VuaVZSTS9ibG9iL21hc3Rlci9TY3JpcHRzL1NwcmluZ0JvbmUvVlJNU3ByaW5nQm9uZS5jc1xyXG5cclxuY29uc3QgSURFTlRJVFlfTUFUUklYNCA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLk1hdHJpeDQoKSk7XHJcbmNvbnN0IElERU5USVRZX1FVQVRFUk5JT04gPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkpO1xyXG5cclxuLy8g6KiI566X5Lit44Gu5LiA5pmC5L+d5a2Y55So5aSJ5pWw77yI5LiA5bqm44Kk44Oz44K544K/44Oz44K544KS5L2c44Gj44Gf44KJ44GC44Go44Gv5L2/44GE5Zue44GZ77yJXHJcbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3YzQyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbmNvbnN0IF9xdWF0QSA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcbmNvbnN0IF9tYXRBID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcclxuY29uc3QgX21hdEIgPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xyXG5cclxuLyoqXHJcbiAqIEEgY2xhc3MgcmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBvZiBhIFZSTS5cclxuICogSXQgc2hvdWxkIGJlIG1hbmFnZWQgYnkgYSBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZSB7XHJcbiAgLyoqXHJcbiAgICogUmFkaXVzIG9mIHRoZSBib25lLCB3aWxsIGJlIHVzZWQgZm9yIGNvbGxpc2lvbi5cclxuICAgKi9cclxuICBwdWJsaWMgcmFkaXVzOiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0aWZmbmVzcyBmb3JjZSBvZiB0aGUgYm9uZS4gSW5jcmVhc2luZyB0aGUgdmFsdWUgPSBmYXN0ZXIgY29udmVyZ2VuY2UgKGZlZWxzIFwiaGFyZGVyXCIpLlxyXG4gICAqIE9uIFVuaVZSTSwgaXRzIHJhbmdlIG9uIEdVSSBpcyBiZXR3ZWVuIGAwLjBgIGFuZCBgNC4wYCAuXHJcbiAgICovXHJcbiAgcHVibGljIHN0aWZmbmVzc0ZvcmNlOiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIFBvd2VyIG9mIHRoZSBncmF2aXR5IGFnYWluc3QgdGhpcyBib25lLlxyXG4gICAqIFRoZSBcInBvd2VyXCIgdXNlZCBpbiBoZXJlIGlzIHZlcnkgZmFyIGZyb20gc2NpZW50aWZpYyBwaHlzaWNzIHRlcm0uLi5cclxuICAgKi9cclxuICBwdWJsaWMgZ3Jhdml0eVBvd2VyOiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIERpcmVjdGlvbiBvZiB0aGUgZ3Jhdml0eSBhZ2FpbnN0IHRoaXMgYm9uZS5cclxuICAgKiBVc3VhbGx5IGl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBncmF2aXR5RGlyOiBUSFJFRS5WZWN0b3IzO1xyXG5cclxuICAvKipcclxuICAgKiBEcmFnIGZvcmNlIG9mIHRoZSBib25lLiBJbmNyZWFzaW5nIHRoZSB2YWx1ZSA9IGxlc3Mgb3NjaWxsYXRpb24gKGZlZWxzIFwiaGVhdmllclwiKS5cclxuICAgKiBPbiBVbmlWUk0sIGl0cyByYW5nZSBvbiBHVUkgaXMgYmV0d2VlbiBgMC4wYCBhbmQgYDEuMGAgLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBkcmFnRm9yY2U6IG51bWJlcjtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29sbGlkZXIgZ3JvdXBzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cclxuICAgKi9cclxuICBwdWJsaWMgY29sbGlkZXJzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoW107XHJcblxyXG4gIC8qKlxyXG4gICAqIEFuIE9iamVjdDNEIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgYm9uZTogVEhSRUUuT2JqZWN0M0Q7XHJcblxyXG4gIC8qKlxyXG4gICAqIEN1cnJlbnQgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXHJcbiAgICovXHJcbiAgcHJvdGVjdGVkIF9jdXJyZW50VGFpbCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcblxyXG4gIC8qKlxyXG4gICAqIFByZXZpb3VzIHBvc2l0aW9uIG9mIGNoaWxkIHRhaWwsIGluIHdvcmxkIHVuaXQuIFdpbGwgYmUgdXNlZCBmb3IgdmVybGV0IGludGVncmF0aW9uLlxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBfcHJldlRhaWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBOZXh0IHBvc2l0aW9uIG9mIGNoaWxkIHRhaWwsIGluIHdvcmxkIHVuaXQuIFdpbGwgYmUgdXNlZCBmb3IgdmVybGV0IGludGVncmF0aW9uLlxyXG4gICAqIEFjdHVhbGx5IHVzZWQgb25seSBpbiBbW3VwZGF0ZV1dIGFuZCBpdCdzIGtpbmQgb2YgdGVtcG9yYXJ5IHZhcmlhYmxlLlxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBfbmV4dFRhaWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsIGF4aXMgb2YgdGhlIGJvbmUsIGluIGxvY2FsIHVuaXQuXHJcbiAgICovXHJcbiAgcHJvdGVjdGVkIF9ib25lQXhpcyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcblxyXG4gIC8qKlxyXG4gICAqIExlbmd0aCBvZiB0aGUgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIG5vcm1hbGl6YXRpb24gaW4gdXBkYXRlIGxvb3AuXHJcbiAgICogSXQncyBzYW1lIGFzIGxvY2FsIHVuaXQgbGVuZ3RoIHVubGVzcyB0aGVyZSBhcmUgc2NhbGUgdHJhbnNmb3JtYXRpb24gaW4gd29ybGQgbWF0cml4LlxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VCb25lTGVuZ3RoOiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIFBvc2l0aW9uIG9mIHRoaXMgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSwga2luZCBvZiBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cclxuICAgKi9cclxuICBwcm90ZWN0ZWQgX2NlbnRlclNwYWNlUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBUaGlzIHNwcmluZ2JvbmUgd2lsbCBiZSBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBzcGFjZSByZWxhdGl2ZSBmcm9tIHRoaXMgb2JqZWN0LlxyXG4gICAqIElmIHRoaXMgaXMgYG51bGxgLCBzcHJpbmdib25lIHdpbGwgYmUgY2FsY3VsYXRlZCBpbiB3b3JsZCBzcGFjZS5cclxuICAgKi9cclxuICBwcm90ZWN0ZWQgX2NlbnRlcjogVEhSRUUuT2JqZWN0M0QgfCBudWxsID0gbnVsbDtcclxuICBwdWJsaWMgZ2V0IGNlbnRlcigpOiBUSFJFRS5PYmplY3QzRCB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuX2NlbnRlcjtcclxuICB9XHJcbiAgcHVibGljIHNldCBjZW50ZXIoY2VudGVyOiBUSFJFRS5PYmplY3QzRCB8IG51bGwpIHtcclxuICAgIC8vIGNvbnZlcnQgdGFpbHMgdG8gd29ybGQgc3BhY2VcclxuICAgIHRoaXMuX2dldE1hdHJpeENlbnRlclRvV29ybGQoX21hdEEpO1xyXG5cclxuICAgIHRoaXMuX2N1cnJlbnRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XHJcbiAgICB0aGlzLl9wcmV2VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xyXG4gICAgdGhpcy5fbmV4dFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcclxuXHJcbiAgICAvLyB1bmluc3RhbGwgaW52ZXJzZSBjYWNoZVxyXG4gICAgaWYgKHRoaXMuX2NlbnRlcj8udXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkpIHtcclxuICAgICAgKHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSBhcyBNYXRyaXg0SW52ZXJzZUNhY2hlKS5yZXZlcnQoKTtcclxuICAgICAgZGVsZXRlIHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBjaGFuZ2UgdGhlIGNlbnRlclxyXG4gICAgdGhpcy5fY2VudGVyID0gY2VudGVyO1xyXG5cclxuICAgIC8vIGluc3RhbGwgaW52ZXJzZSBjYWNoZVxyXG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xyXG4gICAgICBpZiAoIXRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSkge1xyXG4gICAgICAgIHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSA9IG5ldyBNYXRyaXg0SW52ZXJzZUNhY2hlKHRoaXMuX2NlbnRlci5tYXRyaXhXb3JsZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBjb252ZXJ0IHRhaWxzIHRvIGNlbnRlciBzcGFjZVxyXG4gICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0QSk7XHJcblxyXG4gICAgdGhpcy5fY3VycmVudFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcclxuICAgIHRoaXMuX3ByZXZUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XHJcbiAgICB0aGlzLl9uZXh0VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xyXG5cclxuICAgIC8vIGNvbnZlcnQgY2VudGVyIHNwYWNlIGRlcGVuZGFudCBzdGF0ZVxyXG4gICAgX21hdEEubXVsdGlwbHkodGhpcy5ib25lLm1hdHJpeFdvcmxkKTsgLy8g8J+UpSA/P1xyXG5cclxuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKF9tYXRBKTtcclxuXHJcbiAgICB0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGggPSBfdjNBXHJcbiAgICAgIC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pXHJcbiAgICAgIC5hcHBseU1hdHJpeDQoX21hdEEpXHJcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcclxuICAgICAgLmxlbmd0aCgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUm90YXRpb24gb2YgcGFyZW50IGJvbmUsIGluIHdvcmxkIHVuaXQuXHJcbiAgICogV2Ugc2hvdWxkIHVwZGF0ZSB0aGlzIGNvbnN0YW50bHkgaW4gW1t1cGRhdGVdXS5cclxuICAgKi9cclxuICBwcml2YXRlIF9wYXJlbnRXb3JsZFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgbG9jYWwgbWF0cml4IG9mIHRoZSBib25lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbE1hdHJpeCA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWwgc3RhdGUgb2YgdGhlIHJvdGF0aW9uIG9mIHRoZSBib25lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgcG9zaXRpb24gb2YgaXRzIGNoaWxkLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgVlJNU3ByaW5nQm9uZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBib25lIEFuIE9iamVjdDNEIHRoYXQgd2lsbCBiZSBhdHRhY2hlZCB0byB0aGlzIGJvbmVcclxuICAgKiBAcGFyYW0gcGFyYW1zIFNldmVyYWwgcGFyYW1ldGVycyByZWxhdGVkIHRvIGJlaGF2aW9yIG9mIHRoZSBzcHJpbmcgYm9uZVxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGJvbmU6IFRIUkVFLk9iamVjdDNELCBwYXJhbXM6IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzID0ge30pIHtcclxuICAgIHRoaXMuYm9uZSA9IGJvbmU7IC8vIHVuaVZSTeOBp+OBriBwYXJlbnRcclxuICAgIHRoaXMuYm9uZS5tYXRyaXhBdXRvVXBkYXRlID0gZmFsc2U7IC8vIHVwZGF0ZeOBq+OCiOOCiuioiOeul+OBleOCjOOCi+OBruOBp3RocmVlLmpz5YaF44Gn44Gu6Ieq5YuV5Yem55CG44Gv5LiN6KaBXHJcblxyXG4gICAgdGhpcy5yYWRpdXMgPSBwYXJhbXMucmFkaXVzID8/IDAuMDI7XHJcbiAgICB0aGlzLnN0aWZmbmVzc0ZvcmNlID0gcGFyYW1zLnN0aWZmbmVzc0ZvcmNlID8/IDEuMDtcclxuICAgIHRoaXMuZ3Jhdml0eURpciA9IHBhcmFtcy5ncmF2aXR5RGlyXHJcbiAgICAgID8gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KHBhcmFtcy5ncmF2aXR5RGlyKVxyXG4gICAgICA6IG5ldyBUSFJFRS5WZWN0b3IzKCkuc2V0KDAuMCwgLTEuMCwgMC4wKTtcclxuICAgIHRoaXMuZ3Jhdml0eVBvd2VyID0gcGFyYW1zLmdyYXZpdHlQb3dlciA/PyAwLjA7XHJcbiAgICB0aGlzLmRyYWdGb3JjZSA9IHBhcmFtcy5kcmFnRm9yY2UgPz8gMC40O1xyXG4gICAgdGhpcy5jb2xsaWRlcnMgPSBwYXJhbXMuY29sbGlkZXJzID8/IFtdO1xyXG5cclxuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7XHJcblxyXG4gICAgdGhpcy5faW5pdGlhbExvY2FsTWF0cml4LmNvcHkodGhpcy5ib25lLm1hdHJpeCk7XHJcbiAgICB0aGlzLl9pbml0aWFsTG9jYWxSb3RhdGlvbi5jb3B5KHRoaXMuYm9uZS5xdWF0ZXJuaW9uKTtcclxuXHJcbiAgICBpZiAodGhpcy5ib25lLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAvLyDmnKvnq6/jga7jg5zjg7zjg7PjgILlrZDjg5zjg7zjg7PjgYzjgYTjgarjgYTjgZ/jgoHjgIzoh6rliIbjga7lsJHjgZflhYjjgI3jgYzlrZDjg5zjg7zjg7PjgajjgYTjgYbjgZPjgajjgavjgZnjgotcclxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2R3YW5nby9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9TcHJpbmdCb25lL1ZSTVNwcmluZ0JvbmUuY3MjTDI0NlxyXG4gICAgICB0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uLmNvcHkodGhpcy5ib25lLnBvc2l0aW9uKS5ub3JtYWxpemUoKS5tdWx0aXBseVNjYWxhcigwLjA3KTsgLy8gbWFnaWMgbnVtYmVyISBkZXJpdmVzIGZyb20gb3JpZ2luYWwgc291cmNlXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBmaXJzdENoaWxkID0gdGhpcy5ib25lLmNoaWxkcmVuWzBdO1xyXG4gICAgICB0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uLmNvcHkoZmlyc3RDaGlsZC5wb3NpdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ib25lLmxvY2FsVG9Xb3JsZCh0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pKTtcclxuICAgIHRoaXMuX3ByZXZUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xyXG4gICAgdGhpcy5fbmV4dFRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XHJcblxyXG4gICAgdGhpcy5fYm9uZUF4aXMuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKS5ub3JtYWxpemUoKTtcclxuICAgIHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aCA9IF92M0FcclxuICAgICAgLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbilcclxuICAgICAgLmFwcGx5TWF0cml4NCh0aGlzLmJvbmUubWF0cml4V29ybGQpXHJcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcclxuICAgICAgLmxlbmd0aCgpO1xyXG5cclxuICAgIHRoaXMuY2VudGVyID0gcGFyYW1zLmNlbnRlciA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXQgdGhlIHN0YXRlIG9mIHRoaXMgYm9uZS5cclxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIucmVzZXRdXSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcclxuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pO1xyXG5cclxuICAgIC8vIFdlIG5lZWQgdG8gdXBkYXRlIGl0cyBtYXRyaXhXb3JsZCBtYW51YWxseSwgc2luY2Ugd2UgdHdlYWtlZCB0aGUgYm9uZSBieSBvdXIgaGFuZFxyXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xyXG4gICAgdGhpcy5ib25lLm1hdHJpeFdvcmxkLm11bHRpcGx5TWF0cmljZXModGhpcy5fZ2V0UGFyZW50TWF0cml4V29ybGQoKSwgdGhpcy5ib25lLm1hdHJpeCk7XHJcbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbih0aGlzLmJvbmUubWF0cml4V29ybGQpO1xyXG5cclxuICAgIC8vIEFwcGx5IHVwZGF0ZWQgcG9zaXRpb24gdG8gdGFpbCBzdGF0ZXNcclxuICAgIHRoaXMuYm9uZS5sb2NhbFRvV29ybGQodGhpcy5fY3VycmVudFRhaWwuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKSk7XHJcbiAgICB0aGlzLl9wcmV2VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcclxuICAgIHRoaXMuX25leHRUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBzdGF0ZSBvZiB0aGlzIGJvbmUuXHJcbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gY2FsbCBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnVwZGF0ZV1dIGluc3RlYWQuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXHJcbiAgICovXHJcbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoZGVsdGEgPD0gMCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIOimquOCueODl+ODquODs+OCsOODnOODvOODs+OBruWnv+WLouOBr+W4uOOBq+WkieWMluOBl+OBpuOBhOOCi+OAglxyXG4gICAgLy8g44Gd44KM44Gr5Z+644Gl44GE44Gm5Yem55CG55u05YmN44Gr6Ieq5YiG44Gud29ybGRNYXRyaXjjgpLmm7TmlrDjgZfjgabjgYrjgY9cclxuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xyXG5cclxuICAgIGlmICh0aGlzLmJvbmUucGFyZW50KSB7XHJcbiAgICAgIC8vIFNwcmluZ0JvbmXjga/opqrjgYvjgonpoIbjgavlh6bnkIbjgZXjgozjgabjgYTjgY/jgZ/jgoHjgIFcclxuICAgICAgLy8g6Kaq44GubWF0cml4V29ybGTjga/mnIDmlrDnirbmhYvjga7liY3mj5Djgad3b3JsZE1hdHJpeOOBi+OCiXF1YXRlcm5pb27jgpLlj5bjgorlh7rjgZnjgIJcclxuICAgICAgLy8g5Yi26ZmQ44Gv44GC44KL44GR44KM44Gp44CB6KiI566X44Gv5bCR44Gq44GE44Gu44GnZ2V0V29ybGRRdWF0ZXJuaW9u44Gn44Gv44Gq44GP44GT44Gu5pa55rOV44KS5Y+W44KL44CCXHJcbiAgICAgIGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5ib25lLnBhcmVudCwgdGhpcy5fcGFyZW50V29ybGRSb3RhdGlvbik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9wYXJlbnRXb3JsZFJvdGF0aW9uLmNvcHkoSURFTlRJVFlfUVVBVEVSTklPTik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2V0IGJvbmUgcG9zaXRpb24gaW4gY2VudGVyIHNwYWNlXHJcbiAgICB0aGlzLl9nZXRNYXRyaXhXb3JsZFRvQ2VudGVyKF9tYXRBKTtcclxuICAgIF9tYXRBLm11bHRpcGx5KHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7IC8vIPCflKUgPz9cclxuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKF9tYXRBKTtcclxuXHJcbiAgICAvLyBHZXQgcGFyZW50IHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxyXG4gICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0Qik7XHJcbiAgICBfbWF0Qi5tdWx0aXBseSh0aGlzLl9nZXRQYXJlbnRNYXRyaXhXb3JsZCgpKTtcclxuXHJcbiAgICAvLyBzZXZlcmFsIHBhcmFtZXRlcnNcclxuICAgIGNvbnN0IHN0aWZmbmVzcyA9IHRoaXMuc3RpZmZuZXNzRm9yY2UgKiBkZWx0YTtcclxuICAgIGNvbnN0IGV4dGVybmFsID0gX3YzQi5jb3B5KHRoaXMuZ3Jhdml0eURpcikubXVsdGlwbHlTY2FsYXIodGhpcy5ncmF2aXR5UG93ZXIgKiBkZWx0YSk7XHJcblxyXG4gICAgLy8gdmVybGV056mN5YiG44Gn5qyh44Gu5L2N572u44KS6KiI566XXHJcbiAgICB0aGlzLl9uZXh0VGFpbFxyXG4gICAgICAuY29weSh0aGlzLl9jdXJyZW50VGFpbClcclxuICAgICAgLmFkZChcclxuICAgICAgICBfdjNBXHJcbiAgICAgICAgICAuY29weSh0aGlzLl9jdXJyZW50VGFpbClcclxuICAgICAgICAgIC5zdWIodGhpcy5fcHJldlRhaWwpXHJcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoMSAtIHRoaXMuZHJhZ0ZvcmNlKSxcclxuICAgICAgKSAvLyDliY3jg5Xjg6zjg7zjg6Djga7np7vli5XjgpLntpnntprjgZnjgoso5rib6KGw44KC44GC44KL44KIKVxyXG4gICAgICAuYWRkKFxyXG4gICAgICAgIF92M0FcclxuICAgICAgICAgIC5jb3B5KHRoaXMuX2JvbmVBeGlzKVxyXG4gICAgICAgICAgLmFwcGx5TWF0cml4NCh0aGlzLl9pbml0aWFsTG9jYWxNYXRyaXgpXHJcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KF9tYXRCKVxyXG4gICAgICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxyXG4gICAgICAgICAgLm5vcm1hbGl6ZSgpXHJcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoc3RpZmZuZXNzKSxcclxuICAgICAgKSAvLyDopqrjga7lm57ou6LjgavjgojjgovlrZDjg5zjg7zjg7Pjga7np7vli5Xnm67mqJlcclxuICAgICAgLmFkZChleHRlcm5hbCk7IC8vIOWkluWKm+OBq+OCiOOCi+enu+WLlemHj1xyXG5cclxuICAgIC8vIG5vcm1hbGl6ZSBib25lIGxlbmd0aFxyXG4gICAgdGhpcy5fbmV4dFRhaWxcclxuICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxyXG4gICAgICAubm9ybWFsaXplKClcclxuICAgICAgLm11bHRpcGx5U2NhbGFyKHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aClcclxuICAgICAgLmFkZCh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcclxuXHJcbiAgICAvLyBDb2xsaXNpb27jgafnp7vli5VcclxuICAgIHRoaXMuX2NvbGxpc2lvbih0aGlzLl9uZXh0VGFpbCk7XHJcblxyXG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XHJcbiAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX25leHRUYWlsKTtcclxuXHJcbiAgICAvLyBBcHBseSByb3RhdGlvbiwgY29udmVydCB2ZWN0b3IzIHRoaW5nIGludG8gYWN0dWFsIHF1YXRlcm5pb25cclxuICAgIC8vIE9yaWdpbmFsIFVuaVZSTSBpcyBkb2luZyB3b3JsZCB1bml0IGNhbGN1bHVzIGF0IGhlcmUgYnV0IHdlJ3JlIGdvbm5hIGRvIHRoaXMgb24gbG9jYWwgdW5pdFxyXG4gICAgLy8gc2luY2UgVGhyZWUuanMgaXMgbm90IGdvb2QgYXQgd29ybGQgY29vcmRpbmF0aW9uIHN0dWZmXHJcbiAgICBjb25zdCBpbml0aWFsQ2VudGVyU3BhY2VNYXRyaXhJbnYgPSBtYXQ0SW52ZXJ0Q29tcGF0KF9tYXRBLmNvcHkoX21hdEIubXVsdGlwbHkodGhpcy5faW5pdGlhbExvY2FsTWF0cml4KSkpO1xyXG4gICAgY29uc3QgYXBwbHlSb3RhdGlvbiA9IF9xdWF0QS5zZXRGcm9tVW5pdFZlY3RvcnMoXHJcbiAgICAgIHRoaXMuX2JvbmVBeGlzLFxyXG4gICAgICBfdjNBLmNvcHkodGhpcy5fbmV4dFRhaWwpLmFwcGx5TWF0cml4NChpbml0aWFsQ2VudGVyU3BhY2VNYXRyaXhJbnYpLm5vcm1hbGl6ZSgpLFxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLmJvbmUucXVhdGVybmlvbi5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbFJvdGF0aW9uKS5tdWx0aXBseShhcHBseVJvdGF0aW9uKTtcclxuXHJcbiAgICAvLyBXZSBuZWVkIHRvIHVwZGF0ZSBpdHMgbWF0cml4V29ybGQgbWFudWFsbHksIHNpbmNlIHdlIHR3ZWFrZWQgdGhlIGJvbmUgYnkgb3VyIGhhbmRcclxuICAgIHRoaXMuYm9uZS51cGRhdGVNYXRyaXgoKTtcclxuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRG8gY29sbGlzaW9uIG1hdGggYWdhaW5zdCBldmVyeSBjb2xsaWRlcnMgYXR0YWNoZWQgdG8gdGhpcyBib25lLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHRhaWwgVGhlIHRhaWwgeW91IHdhbnQgdG8gcHJvY2Vzc1xyXG4gICAqL1xyXG4gIHByaXZhdGUgX2NvbGxpc2lvbih0YWlsOiBUSFJFRS5WZWN0b3IzKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xyXG4gICAgICB0aGlzLl9nZXRNYXRyaXhXb3JsZFRvQ2VudGVyKF9tYXRBKTtcclxuICAgICAgX21hdEEubXVsdGlwbHkoY29sbGlkZXIubWF0cml4V29ybGQpO1xyXG4gICAgICBjb25zdCBjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24gPSBfdjNBLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XHJcbiAgICAgIGNvbnN0IGNvbGxpZGVyUmFkaXVzID0gY29sbGlkZXIuZ2VvbWV0cnkuYm91bmRpbmdTcGhlcmUhLnJhZGl1czsgLy8gdGhlIGJvdW5kaW5nIHNwaGVyZSBpcyBndWFyYW50ZWVkIHRvIGJlIGV4aXN0IGJ5IFZSTVNwcmluZ0JvbmVJbXBvcnRlci5fY3JlYXRlQ29sbGlkZXJNZXNoXHJcbiAgICAgIGNvbnN0IHIgPSB0aGlzLnJhZGl1cyArIGNvbGxpZGVyUmFkaXVzO1xyXG5cclxuICAgICAgaWYgKHRhaWwuZGlzdGFuY2VUb1NxdWFyZWQoY29sbGlkZXJDZW50ZXJTcGFjZVBvc2l0aW9uKSA8PSByICogcikge1xyXG4gICAgICAgIC8vIOODkuODg+ODiOOAgkNvbGxpZGVy44Gu5Y2K5b6E5pa55ZCR44Gr5oq844GX5Ye644GZXHJcbiAgICAgICAgY29uc3Qgbm9ybWFsID0gX3YzQi5zdWJWZWN0b3JzKHRhaWwsIGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikubm9ybWFsaXplKCk7XHJcbiAgICAgICAgY29uc3QgcG9zRnJvbUNvbGxpZGVyID0gX3YzQy5hZGRWZWN0b3JzKGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbiwgbm9ybWFsLm11bHRpcGx5U2NhbGFyKHIpKTtcclxuXHJcbiAgICAgICAgLy8gbm9ybWFsaXplIGJvbmUgbGVuZ3RoXHJcbiAgICAgICAgdGFpbC5jb3B5KFxyXG4gICAgICAgICAgcG9zRnJvbUNvbGxpZGVyXHJcbiAgICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcclxuICAgICAgICAgICAgLm5vcm1hbGl6ZSgpXHJcbiAgICAgICAgICAgIC5tdWx0aXBseVNjYWxhcih0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGgpXHJcbiAgICAgICAgICAgIC5hZGQodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbiksXHJcbiAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBtYXRyaXggdGhhdCBjb252ZXJ0cyBjZW50ZXIgc3BhY2UgaW50byB3b3JsZCBzcGFjZS5cclxuICAgKiBAcGFyYW0gdGFyZ2V0IFRhcmdldCBtYXRyaXhcclxuICAgKi9cclxuICBwcml2YXRlIF9nZXRNYXRyaXhDZW50ZXJUb1dvcmxkKHRhcmdldDogVEhSRUUuTWF0cml4NCk6IFRIUkVFLk1hdHJpeDQge1xyXG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xyXG4gICAgICB0YXJnZXQuY29weSh0aGlzLl9jZW50ZXIubWF0cml4V29ybGQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGFyZ2V0LmlkZW50aXR5KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRhcmdldDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1hdHJpeCB0aGF0IGNvbnZlcnRzIHdvcmxkIHNwYWNlIGludG8gY2VudGVyIHNwYWNlLlxyXG4gICAqIEBwYXJhbSB0YXJnZXQgVGFyZ2V0IG1hdHJpeFxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIodGFyZ2V0OiBUSFJFRS5NYXRyaXg0KTogVEhSRUUuTWF0cml4NCB7XHJcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XHJcbiAgICAgIHRhcmdldC5jb3B5KCh0aGlzLl9jZW50ZXIudXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkgYXMgTWF0cml4NEludmVyc2VDYWNoZSkuaW52ZXJzZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0YXJnZXQuaWRlbnRpdHkoKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgd29ybGQgbWF0cml4IG9mIGl0cyBwYXJlbnQgb2JqZWN0LlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dldFBhcmVudE1hdHJpeFdvcmxkKCk6IFRIUkVFLk1hdHJpeDQge1xyXG4gICAgcmV0dXJuIHRoaXMuYm9uZS5wYXJlbnQgPyB0aGlzLmJvbmUucGFyZW50Lm1hdHJpeFdvcmxkIDogSURFTlRJVFlfTUFUUklYNDtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgVlJNU3ByaW5nQm9uZSB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZSc7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBncm91cCBvZiBhIFZSTS5cclxuICovXHJcbmV4cG9ydCB0eXBlIFZSTVNwcmluZ0JvbmVHcm91cCA9IFZSTVNwcmluZ0JvbmVbXTtcclxuXHJcbi8qKlxyXG4gKiBBIGNsYXNzIG1hbmFnZXMgZXZlcnkgc3ByaW5nIGJvbmVzIG9uIGEgVlJNLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVNYW5hZ2VyIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10gPSBbXTtcclxuICBwdWJsaWMgcmVhZG9ubHkgc3ByaW5nQm9uZUdyb3VwTGlzdDogVlJNU3ByaW5nQm9uZUdyb3VwW10gPSBbXTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXVxyXG4gICAqXHJcbiAgICogQHBhcmFtIHNwcmluZ0JvbmVHcm91cExpc3QgQW4gYXJyYXkgb2YgW1tWUk1TcHJpbmdCb25lR3JvdXBdXVxyXG4gICAqL1xyXG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSwgc3ByaW5nQm9uZUdyb3VwTGlzdDogVlJNU3ByaW5nQm9uZUdyb3VwW10pIHtcclxuICAgIHRoaXMuY29sbGlkZXJHcm91cHMgPSBjb2xsaWRlckdyb3VwcztcclxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdCA9IHNwcmluZ0JvbmVHcm91cExpc3Q7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgYWxsIGJvbmVzIGJlIGNhbGN1bGF0ZWQgYmFzZWQgb24gdGhlIHNwYWNlIHJlbGF0aXZlIGZyb20gdGhpcyBvYmplY3QuXHJcbiAgICogSWYgYG51bGxgIGlzIGdpdmVuLCBzcHJpbmdib25lIHdpbGwgYmUgY2FsY3VsYXRlZCBpbiB3b3JsZCBzcGFjZS5cclxuICAgKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCwgb3IgYG51bGxgXHJcbiAgICovXHJcbiAgcHVibGljIHNldENlbnRlcihyb290OiBUSFJFRS5PYmplY3QzRCB8IG51bGwpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcclxuICAgICAgc3ByaW5nQm9uZUdyb3VwLmZvckVhY2goKHNwcmluZ0JvbmUpID0+IHtcclxuICAgICAgICBzcHJpbmdCb25lLmNlbnRlciA9IHJvb3Q7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgZXZlcnkgc3ByaW5nIGJvbmUgYXR0YWNoZWQgdG8gdGhpcyBtYW5hZ2VyLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBsYXRlVXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcclxuICAgICAgc3ByaW5nQm9uZUdyb3VwLmZvckVhY2goKHNwcmluZ0JvbmUpID0+IHtcclxuICAgICAgICBzcHJpbmdCb25lLnVwZGF0ZShkZWx0YSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNldCBldmVyeSBzcHJpbmcgYm9uZSBhdHRhY2hlZCB0byB0aGlzIG1hbmFnZXIuXHJcbiAgICovXHJcbiAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zcHJpbmdCb25lR3JvdXBMaXN0LmZvckVhY2goKHNwcmluZ0JvbmVHcm91cCkgPT4ge1xyXG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xyXG4gICAgICAgIHNwcmluZ0JvbmUucmVzZXQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlcic7XHJcbmltcG9ydCB7IEdMVEZOb2RlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmUgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCwgVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaCB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lR3JvdXAsIFZSTVNwcmluZ0JvbmVNYW5hZ2VyIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lTWFuYWdlcic7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lUGFyYW1ldGVycyc7XHJcblxyXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbmNvbnN0IF9jb2xsaWRlck1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHsgdmlzaWJsZTogZmFsc2UgfSk7XHJcblxyXG4vKipcclxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1TcHJpbmdCb25lTWFuYWdlcl1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIge1xyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIFtbVlJNTG9va0F0SGVhZF1dIGZyb20gYSBWUk0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVNYW5hZ2VyIHwgbnVsbD4ge1xyXG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XHJcbiAgICBpZiAoIXZybUV4dCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uIHwgdW5kZWZpbmVkID0gdnJtRXh0LnNlY29uZGFyeUFuaW1hdGlvbjtcclxuICAgIGlmICghc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAvLyDooZ3nqoHliKTlrprnkIPkvZPjg6Hjg4Pjgrfjg6XjgIJcclxuICAgIGNvbnN0IGNvbGxpZGVyR3JvdXBzID0gYXdhaXQgdGhpcy5faW1wb3J0Q29sbGlkZXJNZXNoR3JvdXBzKGdsdGYsIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbik7XHJcblxyXG4gICAgLy8g5ZCM44GY5bGe5oCn77yIc3RpZmZpbmVzc+OChGRyYWdGb3JjZeOBjOWQjOOBmO+8ieOBruODnOODvOODs+OBr2JvbmVHcm91cOOBq+OBvuOBqOOCgeOCieOCjOOBpuOBhOOCi+OAglxyXG4gICAgLy8g5LiA5YiX44Gg44GR44Gn44Gv44Gq44GE44GT44Go44Gr5rOo5oSP44CCXHJcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBMaXN0ID0gYXdhaXQgdGhpcy5faW1wb3J0U3ByaW5nQm9uZUdyb3VwTGlzdChnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24sIGNvbGxpZGVyR3JvdXBzKTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFZSTVNwcmluZ0JvbmVNYW5hZ2VyKGNvbGxpZGVyR3JvdXBzLCBzcHJpbmdCb25lR3JvdXBMaXN0KTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBfY3JlYXRlU3ByaW5nQm9uZShib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyA9IHt9KTogVlJNU3ByaW5nQm9uZSB7XHJcbiAgICByZXR1cm4gbmV3IFZSTVNwcmluZ0JvbmUoYm9uZSwgcGFyYW1zKTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBhc3luYyBfaW1wb3J0U3ByaW5nQm9uZUdyb3VwTGlzdChcclxuICAgIGdsdGY6IEdMVEYsXHJcbiAgICBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb246IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb24sXHJcbiAgICBjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSxcclxuICApOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVHcm91cFtdPiB7XHJcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBzOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uU3ByaW5nW10gPSBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24uYm9uZUdyb3VwcyB8fCBbXTtcclxuXHJcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBMaXN0OiBWUk1TcHJpbmdCb25lR3JvdXBbXSA9IFtdO1xyXG5cclxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxyXG4gICAgICBzcHJpbmdCb25lR3JvdXBzLm1hcChhc3luYyAodnJtQm9uZUdyb3VwKSA9PiB7XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLnN0aWZmaW5lc3MgPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIgPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueCA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci55ID09PSB1bmRlZmluZWQgfHxcclxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnogPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlQb3dlciA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZHJhZ0ZvcmNlID09PSB1bmRlZmluZWQgfHxcclxuICAgICAgICAgIHZybUJvbmVHcm91cC5oaXRSYWRpdXMgPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmNvbGxpZGVyR3JvdXBzID09PSB1bmRlZmluZWQgfHxcclxuICAgICAgICAgIHZybUJvbmVHcm91cC5ib25lcyA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuY2VudGVyID09PSB1bmRlZmluZWRcclxuICAgICAgICApIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHN0aWZmbmVzc0ZvcmNlID0gdnJtQm9uZUdyb3VwLnN0aWZmaW5lc3M7XHJcbiAgICAgICAgY29uc3QgZ3Jhdml0eURpciA9IG5ldyBUSFJFRS5WZWN0b3IzKFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueCxcclxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnksXHJcbiAgICAgICAgICAtdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueiwgLy8gVlJNIDAuMCB1c2VzIGxlZnQtaGFuZGVkIHktdXBcclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGdyYXZpdHlQb3dlciA9IHZybUJvbmVHcm91cC5ncmF2aXR5UG93ZXI7XHJcbiAgICAgICAgY29uc3QgZHJhZ0ZvcmNlID0gdnJtQm9uZUdyb3VwLmRyYWdGb3JjZTtcclxuICAgICAgICBjb25zdCByYWRpdXMgPSB2cm1Cb25lR3JvdXAuaGl0UmFkaXVzO1xyXG5cclxuICAgICAgICBjb25zdCBjb2xsaWRlcnM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2hbXSA9IFtdO1xyXG4gICAgICAgIHZybUJvbmVHcm91cC5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckluZGV4KSA9PiB7XHJcbiAgICAgICAgICBjb2xsaWRlcnMucHVzaCguLi5jb2xsaWRlckdyb3Vwc1tjb2xsaWRlckluZGV4XS5jb2xsaWRlcnMpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBzcHJpbmdCb25lR3JvdXA6IFZSTVNwcmluZ0JvbmVHcm91cCA9IFtdO1xyXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxyXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmJvbmVzLm1hcChhc3luYyAobm9kZUluZGV4KSA9PiB7XHJcbiAgICAgICAgICAgIC8vIFZSTeOBruaDheWgseOBi+OCieOAjOaPuuOCjOODouODjuOAjeODnOODvOODs+OBruODq+ODvOODiOOBjOWPluOCjOOCi1xyXG4gICAgICAgICAgICBjb25zdCBzcHJpbmdSb290Qm9uZTogR0xURk5vZGUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgbm9kZUluZGV4KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNlbnRlcjogR0xURk5vZGUgPVxyXG4gICAgICAgICAgICAgIHZybUJvbmVHcm91cC5jZW50ZXIhICE9PSAtMSA/IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCB2cm1Cb25lR3JvdXAuY2VudGVyISkgOiBudWxsO1xyXG5cclxuICAgICAgICAgICAgLy8gaXQncyB3ZWlyZCBidXQgdGhlcmUgbWlnaHQgYmUgY2FzZXMgd2UgY2FuJ3QgZmluZCB0aGUgcm9vdCBib25lXHJcbiAgICAgICAgICAgIGlmICghc3ByaW5nUm9vdEJvbmUpIHtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNwcmluZ1Jvb3RCb25lLnRyYXZlcnNlKChib25lKSA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc3Qgc3ByaW5nQm9uZSA9IHRoaXMuX2NyZWF0ZVNwcmluZ0JvbmUoYm9uZSwge1xyXG4gICAgICAgICAgICAgICAgcmFkaXVzLFxyXG4gICAgICAgICAgICAgICAgc3RpZmZuZXNzRm9yY2UsXHJcbiAgICAgICAgICAgICAgICBncmF2aXR5RGlyLFxyXG4gICAgICAgICAgICAgICAgZ3Jhdml0eVBvd2VyLFxyXG4gICAgICAgICAgICAgICAgZHJhZ0ZvcmNlLFxyXG4gICAgICAgICAgICAgICAgY29sbGlkZXJzLFxyXG4gICAgICAgICAgICAgICAgY2VudGVyLFxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgIHNwcmluZ0JvbmVHcm91cC5wdXNoKHNwcmluZ0JvbmUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0pLFxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHNwcmluZ0JvbmVHcm91cExpc3QucHVzaChzcHJpbmdCb25lR3JvdXApO1xyXG4gICAgICB9KSxcclxuICAgICk7XHJcblxyXG4gICAgcmV0dXJuIHNwcmluZ0JvbmVHcm91cExpc3Q7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gYXJyYXkgb2YgW1tWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cF1dLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXHJcbiAgICogQHBhcmFtIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbiBBIGBzZWNvbmRhcnlBbmltYXRpb25gIGZpZWxkIG9mIFZSTVxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBhc3luYyBfaW1wb3J0Q29sbGlkZXJNZXNoR3JvdXBzKFxyXG4gICAgZ2x0ZjogR0xURixcclxuICAgIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbixcclxuICApOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10+IHtcclxuICAgIGNvbnN0IHZybUNvbGxpZGVyR3JvdXBzID0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLmNvbGxpZGVyR3JvdXBzO1xyXG4gICAgaWYgKHZybUNvbGxpZGVyR3JvdXBzID09PSB1bmRlZmluZWQpIHJldHVybiBbXTtcclxuXHJcbiAgICBjb25zdCBjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSA9IFtdO1xyXG4gICAgdnJtQ29sbGlkZXJHcm91cHMuZm9yRWFjaChhc3luYyAoY29sbGlkZXJHcm91cCkgPT4ge1xyXG4gICAgICBpZiAoY29sbGlkZXJHcm91cC5ub2RlID09PSB1bmRlZmluZWQgfHwgY29sbGlkZXJHcm91cC5jb2xsaWRlcnMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgYm9uZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBjb2xsaWRlckdyb3VwLm5vZGUpO1xyXG4gICAgICBjb25zdCBjb2xsaWRlcnM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2hbXSA9IFtdO1xyXG4gICAgICBjb2xsaWRlckdyb3VwLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldCA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueCA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueSA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueiA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICBjb2xsaWRlci5yYWRpdXMgPT09IHVuZGVmaW5lZFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gX3YzQS5zZXQoXHJcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueCxcclxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC55LFxyXG4gICAgICAgICAgLWNvbGxpZGVyLm9mZnNldC56LCAvLyBWUk0gMC4wIHVzZXMgbGVmdC1oYW5kZWQgeS11cFxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgY29sbGlkZXJNZXNoID0gdGhpcy5fY3JlYXRlQ29sbGlkZXJNZXNoKGNvbGxpZGVyLnJhZGl1cywgb2Zmc2V0KTtcclxuXHJcbiAgICAgICAgYm9uZS5hZGQoY29sbGlkZXJNZXNoKTtcclxuICAgICAgICBjb2xsaWRlcnMucHVzaChjb2xsaWRlck1lc2gpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IGNvbGxpZGVyTWVzaEdyb3VwID0ge1xyXG4gICAgICAgIG5vZGU6IGNvbGxpZGVyR3JvdXAubm9kZSxcclxuICAgICAgICBjb2xsaWRlcnMsXHJcbiAgICAgIH07XHJcbiAgICAgIGNvbGxpZGVyR3JvdXBzLnB1c2goY29sbGlkZXJNZXNoR3JvdXApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGNvbGxpZGVyR3JvdXBzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgY29sbGlkZXIgbWVzaC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSByYWRpdXMgUmFkaXVzIG9mIHRoZSBuZXcgY29sbGlkZXIgbWVzaFxyXG4gICAqIEBwYXJhbSBvZmZzZXQgT2ZmZXN0IG9mIHRoZSBuZXcgY29sbGlkZXIgbWVzaFxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBfY3JlYXRlQ29sbGlkZXJNZXNoKHJhZGl1czogbnVtYmVyLCBvZmZzZXQ6IFRIUkVFLlZlY3RvcjMpOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIHtcclxuICAgIGNvbnN0IGNvbGxpZGVyTWVzaCA9IG5ldyBUSFJFRS5NZXNoKG5ldyBUSFJFRS5TcGhlcmVCdWZmZXJHZW9tZXRyeShyYWRpdXMsIDgsIDQpLCBfY29sbGlkZXJNYXRlcmlhbCk7XHJcblxyXG4gICAgY29sbGlkZXJNZXNoLnBvc2l0aW9uLmNvcHkob2Zmc2V0KTtcclxuXHJcbiAgICAvLyB0aGUgbmFtZSBoYXZlIHRvIGJlIHRoaXMgaW4gb3JkZXIgdG8gZXhjbHVkZSBjb2xsaWRlcnMgZnJvbSBib3VuZGluZyBib3hcclxuICAgIC8vIChTZWUgVmlld2VyLnRzLCBzZWFyY2ggZm9yIGNoaWxkLm5hbWUgPT09ICd2cm1Db2xsaWRlclNwaGVyZScpXHJcbiAgICBjb2xsaWRlck1lc2gubmFtZSA9ICd2cm1Db2xsaWRlclNwaGVyZSc7XHJcblxyXG4gICAgLy8gV2Ugd2lsbCB1c2UgdGhlIHJhZGl1cyBvZiB0aGUgc3BoZXJlIGZvciBjb2xsaXNpb24gdnMgYm9uZXMuXHJcbiAgICAvLyBgYm91bmRpbmdTcGhlcmVgIG11c3QgYmUgY3JlYXRlZCB0byBjb21wdXRlIHRoZSByYWRpdXMuXHJcbiAgICBjb2xsaWRlck1lc2guZ2VvbWV0cnkuY29tcHV0ZUJvdW5kaW5nU3BoZXJlKCk7XHJcblxyXG4gICAgcmV0dXJuIGNvbGxpZGVyTWVzaDtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xyXG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIgfSBmcm9tICcuL2JsZW5kc2hhcGUnO1xyXG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbkltcG9ydGVyIH0gZnJvbSAnLi9maXJzdHBlcnNvbic7XHJcbmltcG9ydCB7IFZSTUh1bWFub2lkSW1wb3J0ZXIgfSBmcm9tICcuL2h1bWFub2lkL1ZSTUh1bWFub2lkSW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlciB9IGZyb20gJy4vbG9va2F0L1ZSTUxvb2tBdEltcG9ydGVyJztcclxuaW1wb3J0IHsgVlJNTWF0ZXJpYWxJbXBvcnRlciB9IGZyb20gJy4vbWF0ZXJpYWwnO1xyXG5pbXBvcnQgeyBWUk1NZXRhSW1wb3J0ZXIgfSBmcm9tICcuL21ldGEvVlJNTWV0YUltcG9ydGVyJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyIH0gZnJvbSAnLi9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVJbXBvcnRlcic7XHJcbmltcG9ydCB7IFZSTSB9IGZyb20gJy4vVlJNJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgVlJNSW1wb3J0ZXJPcHRpb25zIHtcclxuICBtZXRhSW1wb3J0ZXI/OiBWUk1NZXRhSW1wb3J0ZXI7XHJcbiAgbG9va0F0SW1wb3J0ZXI/OiBWUk1Mb29rQXRJbXBvcnRlcjtcclxuICBodW1hbm9pZEltcG9ydGVyPzogVlJNSHVtYW5vaWRJbXBvcnRlcjtcclxuICBibGVuZFNoYXBlSW1wb3J0ZXI/OiBWUk1CbGVuZFNoYXBlSW1wb3J0ZXI7XHJcbiAgZmlyc3RQZXJzb25JbXBvcnRlcj86IFZSTUZpcnN0UGVyc29uSW1wb3J0ZXI7XHJcbiAgbWF0ZXJpYWxJbXBvcnRlcj86IFZSTU1hdGVyaWFsSW1wb3J0ZXI7XHJcbiAgc3ByaW5nQm9uZUltcG9ydGVyPzogVlJNU3ByaW5nQm9uZUltcG9ydGVyO1xyXG59XHJcblxyXG4vKipcclxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1dXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNSW1wb3J0ZXIge1xyXG4gIHByb3RlY3RlZCByZWFkb25seSBfbWV0YUltcG9ydGVyOiBWUk1NZXRhSW1wb3J0ZXI7XHJcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9ibGVuZFNoYXBlSW1wb3J0ZXI6IFZSTUJsZW5kU2hhcGVJbXBvcnRlcjtcclxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2xvb2tBdEltcG9ydGVyOiBWUk1Mb29rQXRJbXBvcnRlcjtcclxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2h1bWFub2lkSW1wb3J0ZXI6IFZSTUh1bWFub2lkSW1wb3J0ZXI7XHJcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9maXJzdFBlcnNvbkltcG9ydGVyOiBWUk1GaXJzdFBlcnNvbkltcG9ydGVyO1xyXG4gIHByb3RlY3RlZCByZWFkb25seSBfbWF0ZXJpYWxJbXBvcnRlcjogVlJNTWF0ZXJpYWxJbXBvcnRlcjtcclxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX3NwcmluZ0JvbmVJbXBvcnRlcjogVlJNU3ByaW5nQm9uZUltcG9ydGVyO1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgVlJNSW1wb3J0ZXIuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gb3B0aW9ucyBbW1ZSTUltcG9ydGVyT3B0aW9uc11dLCBvcHRpb25hbGx5IGNvbnRhaW5zIGltcG9ydGVycyBmb3IgZWFjaCBjb21wb25lbnRcclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3Iob3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30pIHtcclxuICAgIHRoaXMuX21ldGFJbXBvcnRlciA9IG9wdGlvbnMubWV0YUltcG9ydGVyIHx8IG5ldyBWUk1NZXRhSW1wb3J0ZXIoKTtcclxuICAgIHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlciA9IG9wdGlvbnMuYmxlbmRTaGFwZUltcG9ydGVyIHx8IG5ldyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIoKTtcclxuICAgIHRoaXMuX2xvb2tBdEltcG9ydGVyID0gb3B0aW9ucy5sb29rQXRJbXBvcnRlciB8fCBuZXcgVlJNTG9va0F0SW1wb3J0ZXIoKTtcclxuICAgIHRoaXMuX2h1bWFub2lkSW1wb3J0ZXIgPSBvcHRpb25zLmh1bWFub2lkSW1wb3J0ZXIgfHwgbmV3IFZSTUh1bWFub2lkSW1wb3J0ZXIoKTtcclxuICAgIHRoaXMuX2ZpcnN0UGVyc29uSW1wb3J0ZXIgPSBvcHRpb25zLmZpcnN0UGVyc29uSW1wb3J0ZXIgfHwgbmV3IFZSTUZpcnN0UGVyc29uSW1wb3J0ZXIoKTtcclxuICAgIHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIgPSBvcHRpb25zLm1hdGVyaWFsSW1wb3J0ZXIgfHwgbmV3IFZSTU1hdGVyaWFsSW1wb3J0ZXIoKTtcclxuICAgIHRoaXMuX3NwcmluZ0JvbmVJbXBvcnRlciA9IG9wdGlvbnMuc3ByaW5nQm9uZUltcG9ydGVyIHx8IG5ldyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlY2VpdmUgYSBHTFRGIG9iamVjdCByZXRyaWV2ZWQgZnJvbSBgVEhSRUUuR0xURkxvYWRlcmAgYW5kIGNyZWF0ZSBhIG5ldyBbW1ZSTV1dIGluc3RhbmNlLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk0+IHtcclxuICAgIGlmIChnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMgPT09IHVuZGVmaW5lZCB8fCBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMuVlJNID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBWUk0gZXh0ZW5zaW9uIG9uIHRoZSBHTFRGJyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmU7XHJcblxyXG4gICAgc2NlbmUudXBkYXRlTWF0cml4V29ybGQoZmFsc2UpO1xyXG5cclxuICAgIC8vIFNraW5uZWQgb2JqZWN0IHNob3VsZCBub3QgYmUgZnJ1c3R1bUN1bGxlZFxyXG4gICAgLy8gU2luY2UgcHJlLXNraW5uZWQgcG9zaXRpb24gbWlnaHQgYmUgb3V0c2lkZSBvZiB2aWV3XHJcbiAgICBzY2VuZS50cmF2ZXJzZSgob2JqZWN0M2QpID0+IHtcclxuICAgICAgaWYgKChvYmplY3QzZCBhcyBhbnkpLmlzTWVzaCkge1xyXG4gICAgICAgIG9iamVjdDNkLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbWV0YSA9IChhd2FpdCB0aGlzLl9tZXRhSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XHJcblxyXG4gICAgY29uc3QgbWF0ZXJpYWxzID0gKGF3YWl0IHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIuY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICBjb25zdCBodW1hbm9pZCA9IChhd2FpdCB0aGlzLl9odW1hbm9pZEltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAgIGNvbnN0IGZpcnN0UGVyc29uID0gaHVtYW5vaWQgPyAoYXdhaXQgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlci5pbXBvcnQoZ2x0ZiwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XHJcblxyXG4gICAgY29uc3QgYmxlbmRTaGFwZVByb3h5ID0gKGF3YWl0IHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICBjb25zdCBsb29rQXQgPVxyXG4gICAgICBmaXJzdFBlcnNvbiAmJiBibGVuZFNoYXBlUHJveHkgJiYgaHVtYW5vaWRcclxuICAgICAgICA/IChhd2FpdCB0aGlzLl9sb29rQXRJbXBvcnRlci5pbXBvcnQoZ2x0ZiwgZmlyc3RQZXJzb24sIGJsZW5kU2hhcGVQcm94eSwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWRcclxuICAgICAgICA6IHVuZGVmaW5lZDtcclxuXHJcbiAgICBjb25zdCBzcHJpbmdCb25lTWFuYWdlciA9IChhd2FpdCB0aGlzLl9zcHJpbmdCb25lSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBWUk0oe1xyXG4gICAgICBzY2VuZTogZ2x0Zi5zY2VuZSxcclxuICAgICAgbWV0YSxcclxuICAgICAgbWF0ZXJpYWxzLFxyXG4gICAgICBodW1hbm9pZCxcclxuICAgICAgZmlyc3RQZXJzb24sXHJcbiAgICAgIGJsZW5kU2hhcGVQcm94eSxcclxuICAgICAgbG9va0F0LFxyXG4gICAgICBzcHJpbmdCb25lTWFuYWdlcixcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcclxuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZVByb3h5IH0gZnJvbSAnLi9ibGVuZHNoYXBlJztcclxuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuL2ZpcnN0cGVyc29uJztcclxuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuL2h1bWFub2lkJztcclxuaW1wb3J0IHsgVlJNTG9va0F0SGVhZCB9IGZyb20gJy4vbG9va2F0JztcclxuaW1wb3J0IHsgVlJNTWV0YSB9IGZyb20gJy4vbWV0YS9WUk1NZXRhJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuL3NwcmluZ2JvbmUnO1xyXG5pbXBvcnQgeyBkZWVwRGlzcG9zZSB9IGZyb20gJy4vdXRpbHMvZGlzcG9zZXInO1xyXG5pbXBvcnQgeyBWUk1JbXBvcnRlciwgVlJNSW1wb3J0ZXJPcHRpb25zIH0gZnJvbSAnLi9WUk1JbXBvcnRlcic7XHJcblxyXG4vKipcclxuICogUGFyYW1ldGVycyBmb3IgYSBbW1ZSTV1dIGNsYXNzLlxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBWUk1QYXJhbWV0ZXJzIHtcclxuICBzY2VuZTogVEhSRUUuU2NlbmUgfCBUSFJFRS5Hcm91cDsgLy8gQ09NUEFUOiBgR0xURi5zY2VuZWAgaXMgZ29pbmcgdG8gYmUgYFRIUkVFLkdyb3VwYCBpbiByMTE0XHJcbiAgaHVtYW5vaWQ/OiBWUk1IdW1hbm9pZDtcclxuICBibGVuZFNoYXBlUHJveHk/OiBWUk1CbGVuZFNoYXBlUHJveHk7XHJcbiAgZmlyc3RQZXJzb24/OiBWUk1GaXJzdFBlcnNvbjtcclxuICBsb29rQXQ/OiBWUk1Mb29rQXRIZWFkO1xyXG4gIG1hdGVyaWFscz86IFRIUkVFLk1hdGVyaWFsW107XHJcbiAgc3ByaW5nQm9uZU1hbmFnZXI/OiBWUk1TcHJpbmdCb25lTWFuYWdlcjtcclxuICBtZXRhPzogVlJNTWV0YTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEEgY2xhc3MgdGhhdCByZXByZXNlbnRzIGEgc2luZ2xlIFZSTSBtb2RlbC5cclxuICogU2VlIHRoZSBkb2N1bWVudGF0aW9uIG9mIFtbVlJNLmZyb21dXSBmb3IgdGhlIG1vc3QgYmFzaWMgdXNlIG9mIFZSTS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk0ge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk0gZnJvbSBhIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXIuXHJcbiAgICogSXQncyBwcm9iYWJseSBhIHRoaW5nIHdoYXQgeW91IHdhbnQgdG8gZ2V0IHN0YXJ0ZWQgd2l0aCBWUk1zLlxyXG4gICAqXHJcbiAgICogQGV4YW1wbGUgTW9zdCBiYXNpYyB1c2Ugb2YgVlJNXHJcbiAgICogYGBgXHJcbiAgICogY29uc3Qgc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcclxuICAgKlxyXG4gICAqIG5ldyBUSFJFRS5HTFRGTG9hZGVyKCkubG9hZCggJ21vZGVscy90aHJlZS12cm0tZ2lybC52cm0nLCAoIGdsdGYgKSA9PiB7XHJcbiAgICpcclxuICAgKiAgIFRIUkVFLlZSTS5mcm9tKCBnbHRmICkudGhlbiggKCB2cm0gKSA9PiB7XHJcbiAgICpcclxuICAgKiAgICAgc2NlbmUuYWRkKCB2cm0uc2NlbmUgKTtcclxuICAgKlxyXG4gICAqICAgfSApO1xyXG4gICAqXHJcbiAgICogfSApO1xyXG4gICAqIGBgYFxyXG4gICAqXHJcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgR0xURiBvYmplY3QgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXHJcbiAgICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyB0aGF0IHdpbGwgYmUgdXNlZCBpbiBpbXBvcnRlclxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZnJvbShnbHRmOiBHTFRGLCBvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSk6IFByb21pc2U8VlJNPiB7XHJcbiAgICBjb25zdCBpbXBvcnRlciA9IG5ldyBWUk1JbXBvcnRlcihvcHRpb25zKTtcclxuICAgIHJldHVybiBhd2FpdCBpbXBvcnRlci5pbXBvcnQoZ2x0Zik7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIGBUSFJFRS5TY2VuZWAgb3IgYFRIUkVFLkdyb3VwYCAoZGVwZW5kcyBvbiB5b3VyIHRocmVlLmpzIHJldmlzaW9uKSB0aGF0IGNvbnRhaW5zIHRoZSBlbnRpcmUgVlJNLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBzY2VuZTogVEhSRUUuU2NlbmUgfCBUSFJFRS5Hcm91cDsgLy8gQ09NUEFUOiBgR0xURi5zY2VuZWAgaXMgZ29pbmcgdG8gYmUgYFRIUkVFLkdyb3VwYCBpbiByMTE0XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnRhaW5zIFtbVlJNSHVtYW5vaWRdXSBvZiB0aGUgVlJNLlxyXG4gICAqIFlvdSBjYW4gY29udHJvbCBlYWNoIGJvbmVzIHVzaW5nIFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZU5vZGVdXS5cclxuICAgKlxyXG4gICAqIEBUT0RPIEFkZCBhIGxpbmsgdG8gVlJNIHNwZWNcclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5vaWQ/OiBWUk1IdW1hbm9pZDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29udGFpbnMgW1tWUk1CbGVuZFNoYXBlUHJveHldXSBvZiB0aGUgVlJNLlxyXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGNvbnRyb2wgdGhlc2UgZmFjaWFsIGV4cHJlc3Npb25zIHZpYSBbW1ZSTUJsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZV1dLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBibGVuZFNoYXBlUHJveHk/OiBWUk1CbGVuZFNoYXBlUHJveHk7XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnRhaW5zIFtbVlJNRmlyc3RQZXJzb25dXSBvZiB0aGUgVlJNLlxyXG4gICAqIFlvdSBjYW4gdXNlIHZhcmlvdXMgZmVhdHVyZSBvZiB0aGUgZmlyc3RQZXJzb24gZmllbGQuXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGZpcnN0UGVyc29uPzogVlJNRmlyc3RQZXJzb247XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnRhaW5zIFtbVlJNTG9va0F0SGVhZF1dIG9mIHRoZSBWUk0uXHJcbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gdXNlIFtbVlJNTG9va0F0SGVhZC50YXJnZXRdXSB0byBjb250cm9sIHRoZSBleWUgZGlyZWN0aW9uIG9mIHlvdXIgVlJNcy5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbG9va0F0PzogVlJNTG9va0F0SGVhZDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29udGFpbnMgbWF0ZXJpYWxzIG9mIHRoZSBWUk0uXHJcbiAgICogYHVwZGF0ZVZSTU1hdGVyaWFsc2AgbWV0aG9kIG9mIHRoZXNlIG1hdGVyaWFscyB3aWxsIGJlIGNhbGxlZCB2aWEgaXRzIFtbVlJNLnVwZGF0ZV1dIG1ldGhvZC5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWF0ZXJpYWxzPzogVEhSRUUuTWF0ZXJpYWxbXTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29udGFpbnMgbWV0YSBmaWVsZHMgb2YgdGhlIFZSTS5cclxuICAgKiBZb3UgbWlnaHQgd2FudCB0byByZWZlciB0aGVzZSBsaWNlbnNlIGZpZWxkcyBiZWZvcmUgdXNlIHlvdXIgVlJNcy5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWV0YT86IFZSTU1ldGE7XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgW1tWUk1TcHJpbmdCb25lTWFuYWdlcl1dIG1hbmlwdWxhdGVzIGFsbCBzcHJpbmcgYm9uZXMgYXR0YWNoZWQgb24gdGhlIFZSTS5cclxuICAgKiBVc3VhbGx5IHlvdSBkb24ndCBoYXZlIHRvIGNhcmUgYWJvdXQgdGhpcyBwcm9wZXJ0eS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgc3ByaW5nQm9uZU1hbmFnZXI/OiBWUk1TcHJpbmdCb25lTWFuYWdlcjtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFZSTSBpbnN0YW5jZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBwYXJhbXMgW1tWUk1QYXJhbWV0ZXJzXV0gdGhhdCByZXByZXNlbnRzIGNvbXBvbmVudHMgb2YgdGhlIFZSTVxyXG4gICAqL1xyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihwYXJhbXM6IFZSTVBhcmFtZXRlcnMpIHtcclxuICAgIHRoaXMuc2NlbmUgPSBwYXJhbXMuc2NlbmU7XHJcbiAgICB0aGlzLmh1bWFub2lkID0gcGFyYW1zLmh1bWFub2lkO1xyXG4gICAgdGhpcy5ibGVuZFNoYXBlUHJveHkgPSBwYXJhbXMuYmxlbmRTaGFwZVByb3h5O1xyXG4gICAgdGhpcy5maXJzdFBlcnNvbiA9IHBhcmFtcy5maXJzdFBlcnNvbjtcclxuICAgIHRoaXMubG9va0F0ID0gcGFyYW1zLmxvb2tBdDtcclxuICAgIHRoaXMubWF0ZXJpYWxzID0gcGFyYW1zLm1hdGVyaWFscztcclxuICAgIHRoaXMuc3ByaW5nQm9uZU1hbmFnZXIgPSBwYXJhbXMuc3ByaW5nQm9uZU1hbmFnZXI7XHJcbiAgICB0aGlzLm1ldGEgPSBwYXJhbXMubWV0YTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICoqWW91IG5lZWQgdG8gY2FsbCB0aGlzIG9uIHlvdXIgdXBkYXRlIGxvb3AuKipcclxuICAgKlxyXG4gICAqIFRoaXMgZnVuY3Rpb24gdXBkYXRlcyBldmVyeSBWUk0gY29tcG9uZW50cy5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmxvb2tBdCkge1xyXG4gICAgICB0aGlzLmxvb2tBdC51cGRhdGUoZGVsdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmJsZW5kU2hhcGVQcm94eSkge1xyXG4gICAgICB0aGlzLmJsZW5kU2hhcGVQcm94eS51cGRhdGUoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5zcHJpbmdCb25lTWFuYWdlcikge1xyXG4gICAgICB0aGlzLnNwcmluZ0JvbmVNYW5hZ2VyLmxhdGVVcGRhdGUoZGVsdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm1hdGVyaWFscykge1xyXG4gICAgICB0aGlzLm1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbDogYW55KSA9PiB7XHJcbiAgICAgICAgaWYgKG1hdGVyaWFsLnVwZGF0ZVZSTU1hdGVyaWFscykge1xyXG4gICAgICAgICAgbWF0ZXJpYWwudXBkYXRlVlJNTWF0ZXJpYWxzKGRlbHRhKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGlzcG9zZSBldmVyeXRoaW5nIGFib3V0IHRoZSBWUk0gaW5zdGFuY2UuXHJcbiAgICovXHJcbiAgcHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XHJcbiAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XHJcbiAgICBpZiAoc2NlbmUpIHtcclxuICAgICAgZGVlcERpc3Bvc2Uoc2NlbmUpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubWV0YT8udGV4dHVyZT8uZGlzcG9zZSgpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTSB9IGZyb20gJy4uL1ZSTSc7XHJcblxyXG5jb25zdCBfdjJBID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcclxuXHJcbmNvbnN0IF9jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKC0xLCAxLCAtMSwgMSwgLTEsIDEpO1xyXG5jb25zdCBfbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoeyBjb2xvcjogMHhmZmZmZmYsIHNpZGU6IFRIUkVFLkRvdWJsZVNpZGUgfSk7XHJcbmNvbnN0IF9wbGFuZSA9IG5ldyBUSFJFRS5NZXNoKG5ldyBUSFJFRS5QbGFuZUJ1ZmZlckdlb21ldHJ5KDIsIDIpLCBfbWF0ZXJpYWwpO1xyXG5jb25zdCBfc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcclxuX3NjZW5lLmFkZChfcGxhbmUpO1xyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3QgYSB0aHVtYm5haWwgaW1hZ2UgYmxvYiBmcm9tIGEge0BsaW5rIFZSTX0uXHJcbiAqIElmIHRoZSB2cm0gZG9lcyBub3QgaGF2ZSBhIHRodW1ibmFpbCwgaXQgd2lsbCB0aHJvdyBhbiBlcnJvci5cclxuICogQHBhcmFtIHJlbmRlcmVyIFJlbmRlcmVyXHJcbiAqIEBwYXJhbSB2cm0gVlJNIHdpdGggYSB0aHVtYm5haWxcclxuICogQHBhcmFtIHNpemUgd2lkdGggLyBoZWlnaHQgb2YgdGhlIGltYWdlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFRodW1ibmFpbEJsb2IocmVuZGVyZXI6IFRIUkVFLldlYkdMUmVuZGVyZXIsIHZybTogVlJNLCBzaXplID0gNTEyKTogUHJvbWlzZTxCbG9iPiB7XHJcbiAgLy8gZ2V0IHRoZSB0ZXh0dXJlXHJcbiAgY29uc3QgdGV4dHVyZSA9IHZybS5tZXRhPy50ZXh0dXJlO1xyXG4gIGlmICghdGV4dHVyZSkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdleHRyYWN0VGh1bWJuYWlsQmxvYjogVGhpcyBWUk0gZG9lcyBub3QgaGF2ZSBhIHRodW1ibmFpbCcpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgY2FudmFzID0gcmVuZGVyZXIuZ2V0Q29udGV4dCgpLmNhbnZhcztcclxuXHJcbiAgLy8gc3RvcmUgdGhlIGN1cnJlbnQgcmVzb2x1dGlvblxyXG4gIHJlbmRlcmVyLmdldFNpemUoX3YyQSk7XHJcbiAgY29uc3QgcHJldldpZHRoID0gX3YyQS54O1xyXG4gIGNvbnN0IHByZXZIZWlnaHQgPSBfdjJBLnk7XHJcblxyXG4gIC8vIG92ZXJ3cml0ZSB0aGUgcmVzb2x1dGlvblxyXG4gIHJlbmRlcmVyLnNldFNpemUoc2l6ZSwgc2l6ZSwgZmFsc2UpO1xyXG5cclxuICAvLyBhc3NpZ24gdGhlIHRleHR1cmUgdG8gcGxhbmVcclxuICBfbWF0ZXJpYWwubWFwID0gdGV4dHVyZTtcclxuXHJcbiAgLy8gcmVuZGVyXHJcbiAgcmVuZGVyZXIucmVuZGVyKF9zY2VuZSwgX2NhbWVyYSk7XHJcblxyXG4gIC8vIHVuYXNzaWduIHRoZSB0ZXh0dXJlXHJcbiAgX21hdGVyaWFsLm1hcCA9IG51bGw7XHJcblxyXG4gIC8vIGdldCBibG9iXHJcbiAgaWYgKGNhbnZhcyBpbnN0YW5jZW9mIE9mZnNjcmVlbkNhbnZhcykge1xyXG4gICAgcmV0dXJuIGNhbnZhcy5jb252ZXJ0VG9CbG9iKCkuZmluYWxseSgoKSA9PiB7XHJcbiAgICAgIC8vIHJldmVydCB0byBwcmV2aW91cyByZXNvbHV0aW9uXHJcbiAgICAgIHJlbmRlcmVyLnNldFNpemUocHJldldpZHRoLCBwcmV2SGVpZ2h0LCBmYWxzZSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjYW52YXMudG9CbG9iKChibG9iKSA9PiB7XHJcbiAgICAgIC8vIHJldmVydCB0byBwcmV2aW91cyByZXNvbHV0aW9uXHJcbiAgICAgIHJlbmRlcmVyLnNldFNpemUocHJldldpZHRoLCBwcmV2SGVpZ2h0LCBmYWxzZSk7XHJcblxyXG4gICAgICBpZiAoYmxvYiA9PSBudWxsKSB7XHJcbiAgICAgICAgcmVqZWN0KCdleHRyYWN0VGh1bWJuYWlsQmxvYjogRmFpbGVkIHRvIGNyZWF0ZSBhIGJsb2InKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXNvbHZlKGJsb2IpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcblxyXG4vKipcclxuICogVHJhdmVyc2UgZ2l2ZW4gb2JqZWN0IGFuZCByZW1vdmUgdW5uZWNlc3NhcmlseSBib3VuZCBqb2ludHMgZnJvbSBldmVyeSBgVEhSRUUuU2tpbm5lZE1lc2hgLlxyXG4gKiBTb21lIGVudmlyb25tZW50cyBsaWtlIG1vYmlsZSBkZXZpY2VzIGhhdmUgYSBsb3dlciBsaW1pdCBvZiBib25lcyBhbmQgbWlnaHQgYmUgdW5hYmxlIHRvIHBlcmZvcm0gbWVzaCBza2lubmluZywgdGhpcyBmdW5jdGlvbiBtaWdodCByZXNvbHZlIHN1Y2ggYW4gaXNzdWUuXHJcbiAqIEFsc28gdGhpcyBmdW5jdGlvbiBtaWdodCBncmVhdGx5IGltcHJvdmUgdGhlIHBlcmZvcm1hbmNlIG9mIG1lc2ggc2tpbm5pbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSByb290IFJvb3Qgb2JqZWN0IHRoYXQgd2lsbCBiZSB0cmF2ZXJzZWRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeUpvaW50cyhyb290OiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xyXG4gIC8vIHNvbWUgbWVzaGVzIG1pZ2h0IHNoYXJlIGEgc2FtZSBza2luSW5kZXggYXR0cmlidXRlIGFuZCB0aGlzIG1hcCBwcmV2ZW50cyB0byBjb252ZXJ0IHRoZSBhdHRyaWJ1dGUgdHdpY2VcclxuICBjb25zdCBza2VsZXRvbkxpc3Q6IE1hcDxUSFJFRS5CdWZmZXJBdHRyaWJ1dGUsIFRIUkVFLlNrZWxldG9uPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgLy8gVHJhdmVyc2UgYW4gZW50aXJlIHRyZWVcclxuICByb290LnRyYXZlcnNlKChvYmopID0+IHtcclxuICAgIGlmIChvYmoudHlwZSAhPT0gJ1NraW5uZWRNZXNoJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbWVzaCA9IG9iaiBhcyBUSFJFRS5Ta2lubmVkTWVzaDtcclxuICAgIGNvbnN0IGdlb21ldHJ5ID0gbWVzaC5nZW9tZXRyeTtcclxuICAgIGNvbnN0IGF0dHJpYnV0ZSA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4JykgYXMgVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xyXG5cclxuICAgIC8vIGxvb2sgZm9yIGV4aXN0aW5nIHNrZWxldG9uXHJcbiAgICBsZXQgc2tlbGV0b24gPSBza2VsZXRvbkxpc3QuZ2V0KGF0dHJpYnV0ZSk7XHJcblxyXG4gICAgaWYgKCFza2VsZXRvbikge1xyXG4gICAgICAvLyBnZW5lcmF0ZSByZWR1Y2VkIGJvbmUgbGlzdFxyXG4gICAgICBjb25zdCBib25lczogVEhSRUUuQm9uZVtdID0gW107IC8vIG5ldyBsaXN0IG9mIGJvbmVcclxuICAgICAgY29uc3QgYm9uZUludmVyc2VzOiBUSFJFRS5NYXRyaXg0W10gPSBbXTsgLy8gbmV3IGxpc3Qgb2YgYm9uZUludmVyc2VcclxuICAgICAgY29uc3QgYm9uZUluZGV4TWFwOiB7IFtpbmRleDogbnVtYmVyXTogbnVtYmVyIH0gPSB7fTsgLy8gbWFwIG9mIG9sZCBib25lIGluZGV4IHZzLiBuZXcgYm9uZSBpbmRleFxyXG5cclxuICAgICAgLy8gY3JlYXRlIGEgbmV3IGJvbmUgbWFwXHJcbiAgICAgIGNvbnN0IGFycmF5ID0gYXR0cmlidXRlLmFycmF5IGFzIG51bWJlcltdO1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgaW5kZXggPSBhcnJheVtpXTtcclxuXHJcbiAgICAgICAgLy8gbmV3IHNraW5JbmRleCBidWZmZXJcclxuICAgICAgICBpZiAoYm9uZUluZGV4TWFwW2luZGV4XSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICBib25lSW5kZXhNYXBbaW5kZXhdID0gYm9uZXMubGVuZ3RoO1xyXG4gICAgICAgICAgYm9uZXMucHVzaChtZXNoLnNrZWxldG9uLmJvbmVzW2luZGV4XSk7XHJcbiAgICAgICAgICBib25lSW52ZXJzZXMucHVzaChtZXNoLnNrZWxldG9uLmJvbmVJbnZlcnNlc1tpbmRleF0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYXJyYXlbaV0gPSBib25lSW5kZXhNYXBbaW5kZXhdO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyByZXBsYWNlIHdpdGggbmV3IGluZGljZXNcclxuICAgICAgYXR0cmlidXRlLmNvcHlBcnJheShhcnJheSk7XHJcbiAgICAgIGF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcblxyXG4gICAgICAvLyByZXBsYWNlIHdpdGggbmV3IGluZGljZXNcclxuICAgICAgc2tlbGV0b24gPSBuZXcgVEhSRUUuU2tlbGV0b24oYm9uZXMsIGJvbmVJbnZlcnNlcyk7XHJcbiAgICAgIHNrZWxldG9uTGlzdC5zZXQoYXR0cmlidXRlLCBza2VsZXRvbik7XHJcbiAgICB9XHJcblxyXG4gICAgbWVzaC5iaW5kKHNrZWxldG9uLCBuZXcgVEhSRUUuTWF0cml4NCgpKTtcclxuICAgIC8vICAgICAgICAgICAgICAgICAgXl5eXl5eXl5eXl5eXl5eXl5eXiB0cmFuc2Zvcm0gb2YgbWVzaGVzIHNob3VsZCBiZSBpZ25vcmVkXHJcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9LaHJvbm9zR3JvdXAvZ2xURi90cmVlL21hc3Rlci9zcGVjaWZpY2F0aW9uLzIuMCNza2luc1xyXG4gIH0pO1xyXG59XHJcbiIsImltcG9ydCB7IGV4dHJhY3RUaHVtYm5haWxCbG9iIH0gZnJvbSAnLi9leHRyYWN0VGh1bWJuYWlsQmxvYic7XHJcbmltcG9ydCB7IHJlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzIH0gZnJvbSAnLi9yZW1vdmVVbm5lY2Vzc2FyeUpvaW50cyc7XHJcblxyXG5leHBvcnQgY2xhc3MgVlJNVXRpbHMge1xyXG4gIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XHJcbiAgICAvLyB0aGlzIGNsYXNzIGlzIG5vdCBtZWFudCB0byBiZSBpbnN0YW50aWF0ZWRcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgZXh0cmFjdFRodW1ibmFpbEJsb2IgPSBleHRyYWN0VGh1bWJuYWlsQmxvYjtcclxuICBwdWJsaWMgc3RhdGljIHJlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzID0gcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHM7XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi4vbG9va2F0L1ZSTUxvb2tBdEhlYWQnO1xyXG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XHJcblxyXG5jb25zdCBfdjMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEhlYWREZWJ1ZyBleHRlbmRzIFZSTUxvb2tBdEhlYWQge1xyXG4gIHByaXZhdGUgX2ZhY2VEaXJlY3Rpb25IZWxwZXI/OiBUSFJFRS5BcnJvd0hlbHBlcjtcclxuXHJcbiAgcHVibGljIHNldHVwSGVscGVyKHNjZW5lOiBUSFJFRS5PYmplY3QzRCwgZGVidWdPcHRpb246IFZSTURlYnVnT3B0aW9ucyk6IHZvaWQge1xyXG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlRmFjZURpcmVjdGlvbkhlbHBlcikge1xyXG4gICAgICB0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyID0gbmV3IFRIUkVFLkFycm93SGVscGVyKFxyXG4gICAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIC0xKSxcclxuICAgICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAwKSxcclxuICAgICAgICAwLjUsXHJcbiAgICAgICAgMHhmZjAwZmYsXHJcbiAgICAgICk7XHJcbiAgICAgIHNjZW5lLmFkZCh0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xyXG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcclxuXHJcbiAgICBpZiAodGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlcikge1xyXG4gICAgICB0aGlzLmZpcnN0UGVyc29uLmdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbih0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyLnBvc2l0aW9uKTtcclxuICAgICAgdGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlci5zZXREaXJlY3Rpb24odGhpcy5nZXRMb29rQXRXb3JsZERpcmVjdGlvbihfdjMpKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xyXG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcclxuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbic7XHJcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi4vbG9va2F0L1ZSTUxvb2tBdEhlYWQnO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlciB9IGZyb20gJy4uL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlcic7XHJcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgVlJNTG9va0F0SGVhZERlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkRGVidWcnO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEltcG9ydGVyRGVidWcgZXh0ZW5kcyBWUk1Mb29rQXRJbXBvcnRlciB7XHJcbiAgcHVibGljIGltcG9ydChcclxuICAgIGdsdGY6IEdMVEYsXHJcbiAgICBmaXJzdFBlcnNvbjogVlJNRmlyc3RQZXJzb24sXHJcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcclxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcclxuICApOiBWUk1Mb29rQXRIZWFkIHwgbnVsbCB7XHJcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcclxuICAgIGlmICghdnJtRXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjaGVtYUZpcnN0UGVyc29uOiBWUk1TY2hlbWEuRmlyc3RQZXJzb24gfCB1bmRlZmluZWQgPSB2cm1FeHQuZmlyc3RQZXJzb247XHJcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFwcGx5ZXIgPSB0aGlzLl9pbXBvcnRBcHBseWVyKHNjaGVtYUZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKTtcclxuICAgIHJldHVybiBuZXcgVlJNTG9va0F0SGVhZERlYnVnKGZpcnN0UGVyc29uLCBhcHBseWVyIHx8IHVuZGVmaW5lZCk7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuLi9zcHJpbmdib25lJztcclxuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVEZWJ1Zyc7XHJcbmltcG9ydCB7IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgfSBmcm9tICcuL1ZSTURlYnVnJztcclxuXHJcbmNvbnN0IF9jb2xsaWRlckdpem1vTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xyXG4gIGNvbG9yOiAweGZmMDBmZixcclxuICB3aXJlZnJhbWU6IHRydWUsXHJcbiAgdHJhbnNwYXJlbnQ6IHRydWUsXHJcbiAgZGVwdGhUZXN0OiBmYWxzZSxcclxufSk7XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBncm91cCBvZiBhIFZSTS5cclxuICovXHJcbmV4cG9ydCB0eXBlIFZSTVNwcmluZ0JvbmVHcm91cERlYnVnID0gVlJNU3ByaW5nQm9uZURlYnVnW107XHJcblxyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyBleHRlbmRzIFZSTVNwcmluZ0JvbmVNYW5hZ2VyIHtcclxuICBwdWJsaWMgc2V0dXBIZWxwZXIoc2NlbmU6IFRIUkVFLk9iamVjdDNELCBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zKTogdm9pZCB7XHJcbiAgICBpZiAoZGVidWdPcHRpb24uZGlzYWJsZVNwcmluZ0JvbmVIZWxwZXIpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XHJcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XHJcbiAgICAgICAgaWYgKChzcHJpbmdCb25lIGFzIGFueSkuZ2V0R2l6bW8pIHtcclxuICAgICAgICAgIGNvbnN0IGdpem1vID0gKHNwcmluZ0JvbmUgYXMgVlJNU3ByaW5nQm9uZURlYnVnKS5nZXRHaXptbygpO1xyXG4gICAgICAgICAgc2NlbmUuYWRkKGdpem1vKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckdyb3VwKSA9PiB7XHJcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XHJcbiAgICAgICAgY29sbGlkZXIubWF0ZXJpYWwgPSBfY29sbGlkZXJHaXptb01hdGVyaWFsO1xyXG4gICAgICAgIGNvbGxpZGVyLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi4vc3ByaW5nYm9uZSc7XHJcbmltcG9ydCB7IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgfSBmcm9tICcuL1ZSTURlYnVnJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgfSBmcm9tICcuLi9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzJztcclxuXHJcbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVEZWJ1ZyBleHRlbmRzIFZSTVNwcmluZ0JvbmUge1xyXG4gIHByaXZhdGUgX2dpem1vPzogVEhSRUUuQXJyb3dIZWxwZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGJvbmU6IFRIUkVFLk9iamVjdDNELCBwYXJhbXM6IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzKSB7XHJcbiAgICBzdXBlcihib25lLCBwYXJhbXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIHNwcmluZyBib25lIGdpem1vLCBhcyBgVEhSRUUuQXJyb3dIZWxwZXJgLlxyXG4gICAqIFVzZWZ1bCBmb3IgZGVidWdnaW5nIHNwcmluZyBib25lcy5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0R2l6bW8oKTogVEhSRUUuQXJyb3dIZWxwZXIge1xyXG4gICAgLy8gcmV0dXJuIGlmIGdpem1vIGlzIGFscmVhZHkgZXhpc3RlZFxyXG4gICAgaWYgKHRoaXMuX2dpem1vKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9naXptbztcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBuZXh0VGFpbFJlbGF0aXZlID0gX3YzQS5jb3B5KHRoaXMuX25leHRUYWlsKS5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbik7XHJcbiAgICBjb25zdCBuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoID0gbmV4dFRhaWxSZWxhdGl2ZS5sZW5ndGgoKTtcclxuXHJcbiAgICB0aGlzLl9naXptbyA9IG5ldyBUSFJFRS5BcnJvd0hlbHBlcihcclxuICAgICAgbmV4dFRhaWxSZWxhdGl2ZS5ub3JtYWxpemUoKSxcclxuICAgICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbixcclxuICAgICAgbmV4dFRhaWxSZWxhdGl2ZUxlbmd0aCxcclxuICAgICAgMHhmZmZmMDAsXHJcbiAgICAgIHRoaXMucmFkaXVzLFxyXG4gICAgICB0aGlzLnJhZGl1cyxcclxuICAgICk7XHJcblxyXG4gICAgLy8gaXQgc2hvdWxkIGJlIGFsd2F5cyB2aXNpYmxlXHJcbiAgICB0aGlzLl9naXptby5saW5lLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcclxuICAgIHRoaXMuX2dpem1vLmNvbmUucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xyXG4gICAgKHRoaXMuX2dpem1vLmxpbmUubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLmRlcHRoVGVzdCA9IGZhbHNlO1xyXG4gICAgKHRoaXMuX2dpem1vLmxpbmUubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLnRyYW5zcGFyZW50ID0gdHJ1ZTtcclxuICAgICh0aGlzLl9naXptby5jb25lLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kZXB0aFRlc3QgPSBmYWxzZTtcclxuICAgICh0aGlzLl9naXptby5jb25lLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS50cmFuc3BhcmVudCA9IHRydWU7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuX2dpem1vO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBzdXBlci51cGRhdGUoZGVsdGEpO1xyXG4gICAgLy8gbGFzdGx5IHdlJ3JlIGdvbm5hIHVwZGF0ZSBnaXptb1xyXG4gICAgdGhpcy5fdXBkYXRlR2l6bW8oKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3VwZGF0ZUdpem1vKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLl9naXptbykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZSA9IF92M0EuY29weSh0aGlzLl9jdXJyZW50VGFpbCkuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xyXG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZUxlbmd0aCA9IG5leHRUYWlsUmVsYXRpdmUubGVuZ3RoKCk7XHJcblxyXG4gICAgdGhpcy5fZ2l6bW8uc2V0RGlyZWN0aW9uKG5leHRUYWlsUmVsYXRpdmUubm9ybWFsaXplKCkpO1xyXG4gICAgdGhpcy5fZ2l6bW8uc2V0TGVuZ3RoKG5leHRUYWlsUmVsYXRpdmVMZW5ndGgsIHRoaXMucmFkaXVzLCB0aGlzLnJhZGl1cyk7XHJcbiAgICB0aGlzLl9naXptby5wb3NpdGlvbi5jb3B5KHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyIH0gZnJvbSAnLi4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lSW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnJztcclxuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVEZWJ1Zyc7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lUGFyYW1ldGVycyc7XHJcblxyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcgZXh0ZW5kcyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIge1xyXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB8IG51bGw+IHtcclxuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xyXG4gICAgaWYgKCF2cm1FeHQpIHJldHVybiBudWxsO1xyXG5cclxuICAgIGNvbnN0IHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5zZWNvbmRhcnlBbmltYXRpb247XHJcbiAgICBpZiAoIXNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbikgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgLy8g6KGd56qB5Yik5a6a55CD5L2T44Oh44OD44K344Ol44CCXHJcbiAgICBjb25zdCBjb2xsaWRlckdyb3VwcyA9IGF3YWl0IHRoaXMuX2ltcG9ydENvbGxpZGVyTWVzaEdyb3VwcyhnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pO1xyXG5cclxuICAgIC8vIOWQjOOBmOWxnuaAp++8iHN0aWZmaW5lc3PjgoRkcmFnRm9yY2XjgYzlkIzjgZjvvInjga7jg5zjg7zjg7Pjga9ib25lR3JvdXDjgavjgb7jgajjgoHjgonjgozjgabjgYTjgovjgIJcclxuICAgIC8vIOS4gOWIl+OBoOOBkeOBp+OBr+OBquOBhOOBk+OBqOOBq+azqOaEj+OAglxyXG4gICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwTGlzdCA9IGF3YWl0IHRoaXMuX2ltcG9ydFNwcmluZ0JvbmVHcm91cExpc3QoZ2x0Ziwgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLCBjb2xsaWRlckdyb3Vwcyk7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnKGNvbGxpZGVyR3JvdXBzLCBzcHJpbmdCb25lR3JvdXBMaXN0KTtcclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBfY3JlYXRlU3ByaW5nQm9uZShib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyk6IFZSTVNwcmluZ0JvbmVEZWJ1ZyB7XHJcbiAgICByZXR1cm4gbmV3IFZSTVNwcmluZ0JvbmVEZWJ1Zyhib25lLCBwYXJhbXMpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlcic7XHJcbmltcG9ydCB7IFZSTUltcG9ydGVyLCBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuLi9WUk1JbXBvcnRlcic7XHJcbmltcG9ydCB7IFZSTURlYnVnIH0gZnJvbSAnLi9WUk1EZWJ1Zyc7XHJcbmltcG9ydCB7IFZSTURlYnVnT3B0aW9ucyB9IGZyb20gJy4vVlJNRGVidWdPcHRpb25zJztcclxuaW1wb3J0IHsgVlJNTG9va0F0SGVhZERlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkRGVidWcnO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRJbXBvcnRlckRlYnVnJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyc7XHJcblxyXG4vKipcclxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1EZWJ1Z11dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1JbXBvcnRlckRlYnVnIGV4dGVuZHMgVlJNSW1wb3J0ZXIge1xyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSkge1xyXG4gICAgb3B0aW9ucy5sb29rQXRJbXBvcnRlciA9IG9wdGlvbnMubG9va0F0SW1wb3J0ZXIgfHwgbmV3IFZSTUxvb2tBdEltcG9ydGVyRGVidWcoKTtcclxuICAgIG9wdGlvbnMuc3ByaW5nQm9uZUltcG9ydGVyID0gb3B0aW9ucy5zcHJpbmdCb25lSW1wb3J0ZXIgfHwgbmV3IFZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnKCk7XHJcbiAgICBzdXBlcihvcHRpb25zKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURiwgZGVidWdPcHRpb25zOiBWUk1EZWJ1Z09wdGlvbnMgPSB7fSk6IFByb21pc2U8VlJNRGVidWc+IHtcclxuICAgIGlmIChnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMgPT09IHVuZGVmaW5lZCB8fCBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMuVlJNID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBWUk0gZXh0ZW5zaW9uIG9uIHRoZSBHTFRGJyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmU7XHJcblxyXG4gICAgc2NlbmUudXBkYXRlTWF0cml4V29ybGQoZmFsc2UpO1xyXG5cclxuICAgIC8vIFNraW5uZWQgb2JqZWN0IHNob3VsZCBub3QgYmUgZnJ1c3R1bUN1bGxlZFxyXG4gICAgLy8gU2luY2UgcHJlLXNraW5uZWQgcG9zaXRpb24gbWlnaHQgYmUgb3V0c2lkZSBvZiB2aWV3XHJcbiAgICBzY2VuZS50cmF2ZXJzZSgob2JqZWN0M2QpID0+IHtcclxuICAgICAgaWYgKChvYmplY3QzZCBhcyBhbnkpLmlzTWVzaCkge1xyXG4gICAgICAgIG9iamVjdDNkLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbWV0YSA9IChhd2FpdCB0aGlzLl9tZXRhSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XHJcblxyXG4gICAgY29uc3QgbWF0ZXJpYWxzID0gKGF3YWl0IHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIuY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICBjb25zdCBodW1hbm9pZCA9IChhd2FpdCB0aGlzLl9odW1hbm9pZEltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAgIGNvbnN0IGZpcnN0UGVyc29uID0gaHVtYW5vaWQgPyAoYXdhaXQgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlci5pbXBvcnQoZ2x0ZiwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XHJcblxyXG4gICAgY29uc3QgYmxlbmRTaGFwZVByb3h5ID0gKGF3YWl0IHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgICBjb25zdCBsb29rQXQgPVxyXG4gICAgICBmaXJzdFBlcnNvbiAmJiBibGVuZFNoYXBlUHJveHkgJiYgaHVtYW5vaWRcclxuICAgICAgICA/IChhd2FpdCB0aGlzLl9sb29rQXRJbXBvcnRlci5pbXBvcnQoZ2x0ZiwgZmlyc3RQZXJzb24sIGJsZW5kU2hhcGVQcm94eSwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWRcclxuICAgICAgICA6IHVuZGVmaW5lZDtcclxuICAgIGlmICgobG9va0F0IGFzIGFueSkuc2V0dXBIZWxwZXIpIHtcclxuICAgICAgKGxvb2tBdCBhcyBWUk1Mb29rQXRIZWFkRGVidWcpLnNldHVwSGVscGVyKHNjZW5lLCBkZWJ1Z09wdGlvbnMpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNwcmluZ0JvbmVNYW5hZ2VyID0gKGF3YWl0IHRoaXMuX3NwcmluZ0JvbmVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcclxuICAgIGlmICgoc3ByaW5nQm9uZU1hbmFnZXIgYXMgYW55KS5zZXR1cEhlbHBlcikge1xyXG4gICAgICAoc3ByaW5nQm9uZU1hbmFnZXIgYXMgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zykuc2V0dXBIZWxwZXIoc2NlbmUsIGRlYnVnT3B0aW9ucyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBWUk1EZWJ1ZyhcclxuICAgICAge1xyXG4gICAgICAgIHNjZW5lOiBnbHRmLnNjZW5lLFxyXG4gICAgICAgIG1ldGEsXHJcbiAgICAgICAgbWF0ZXJpYWxzLFxyXG4gICAgICAgIGh1bWFub2lkLFxyXG4gICAgICAgIGZpcnN0UGVyc29uLFxyXG4gICAgICAgIGJsZW5kU2hhcGVQcm94eSxcclxuICAgICAgICBsb29rQXQsXHJcbiAgICAgICAgc3ByaW5nQm9uZU1hbmFnZXIsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlYnVnT3B0aW9ucyxcclxuICAgICk7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xyXG5pbXBvcnQgeyBWUk0sIFZSTVBhcmFtZXRlcnMgfSBmcm9tICcuLi9WUk0nO1xyXG5pbXBvcnQgeyBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuLi9WUk1JbXBvcnRlcic7XHJcbmltcG9ydCB7IFZSTURlYnVnT3B0aW9ucyB9IGZyb20gJy4vVlJNRGVidWdPcHRpb25zJztcclxuaW1wb3J0IHsgVlJNSW1wb3J0ZXJEZWJ1ZyB9IGZyb20gJy4vVlJNSW1wb3J0ZXJEZWJ1Zyc7XHJcblxyXG5leHBvcnQgY29uc3QgVlJNX0dJWk1PX1JFTkRFUl9PUkRFUiA9IDEwMDAwO1xyXG5cclxuLyoqXHJcbiAqIFtbVlJNXV0gYnV0IGl0IGhhcyBzb21lIHVzZWZ1bCBnaXptb3MuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNRGVidWcgZXh0ZW5kcyBWUk0ge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1EZWJ1ZyBmcm9tIGEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlci5cclxuICAgKlxyXG4gICAqIFNlZSBbW1ZSTS5mcm9tXV0gZm9yIGEgZGV0YWlsZWQgZXhhbXBsZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgdGhhdCB3aWxsIGJlIHVzZWQgaW4gaW1wb3J0ZXJcclxuICAgKiBAcGFyYW0gZGVidWdPcHRpb24gT3B0aW9ucyBmb3IgVlJNRGVidWcgZmVhdHVyZXNcclxuICAgKi9cclxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGZyb20oXHJcbiAgICBnbHRmOiBHTFRGLFxyXG4gICAgb3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30sXHJcbiAgICBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zID0ge30sXHJcbiAgKTogUHJvbWlzZTxWUk0+IHtcclxuICAgIGNvbnN0IGltcG9ydGVyID0gbmV3IFZSTUltcG9ydGVyRGVidWcob3B0aW9ucyk7XHJcbiAgICByZXR1cm4gYXdhaXQgaW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGRlYnVnT3B0aW9uKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1EZWJ1ZyBpbnN0YW5jZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBwYXJhbXMgW1tWUk1QYXJhbWV0ZXJzXV0gdGhhdCByZXByZXNlbnRzIGNvbXBvbmVudHMgb2YgdGhlIFZSTVxyXG4gICAqIEBwYXJhbSBkZWJ1Z09wdGlvbiBPcHRpb25zIGZvciBWUk1EZWJ1ZyBmZWF0dXJlc1xyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKHBhcmFtczogVlJNUGFyYW1ldGVycywgZGVidWdPcHRpb246IFZSTURlYnVnT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcihwYXJhbXMpO1xyXG5cclxuICAgIC8vIEdpem1v44KS5bGV6ZaLXHJcbiAgICBpZiAoIWRlYnVnT3B0aW9uLmRpc2FibGVCb3hIZWxwZXIpIHtcclxuICAgICAgdGhpcy5zY2VuZS5hZGQobmV3IFRIUkVFLkJveEhlbHBlcih0aGlzLnNjZW5lKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlU2tlbGV0b25IZWxwZXIpIHtcclxuICAgICAgdGhpcy5zY2VuZS5hZGQobmV3IFRIUkVFLlNrZWxldG9uSGVscGVyKHRoaXMuc2NlbmUpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xyXG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbIlRIUkVFIiwiX3YzIiwiVlJNU2NoZW1hIiwiVkVDVE9SM19GUk9OVCIsIl9xdWF0IiwiX3YzQSIsIl9xdWF0QSIsIl92M0IiLCJfdjNDIiwiTVRvb25NYXRlcmlhbEN1bGxNb2RlIiwiTVRvb25NYXRlcmlhbERlYnVnTW9kZSIsIk1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIiwiTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUiLCJNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSIsInZlcnRleFNoYWRlciIsImZyYWdtZW50U2hhZGVyIiwiVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUiLCJfbWF0QSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUE7SUFDQTtBQUNBO0lBQ0E7SUFDQTtBQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtBQXVEQTtJQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtJQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtJQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtJQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUks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
