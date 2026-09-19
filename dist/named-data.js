// Name: Named Data
// ID: kubohiroyanameddata
// Description: Shared named-data references and provider registry for TurboWarp extensions.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyanameddata",
  	slug: "named-data",
  	name: "Named Data",
  	description: "Shared named-data references and provider registry for TurboWarp extensions.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: true,
  	docsURI: "https://kubohiroya.github.io/turbowarp-named-data/",
  	blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3QgeD0iNCIgeT0iOCIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE0IiByeD0iMyIgZmlsbD0iIzRDOTdGRiIvPjxyZWN0IHg9IjI2IiB5PSI4IiB3aWR0aD0iMTgiIGhlaWdodD0iMTQiIHJ4PSIzIiBmaWxsPSIjNTlDMDU5Ii8+PHJlY3QgeD0iMTUiIHk9IjI2IiB3aWR0aD0iMTgiIGhlaWdodD0iMTQiIHJ4PSIzIiBmaWxsPSIjRkZBQjE5Ii8+PC9zdmc+"
  };
  var block_definitions_default = {
  	extensionName: "Named Data",
  	runtimeServices: [{
  		"id": "named-data-registry",
  		"contractVersion": "2.0",
  		"symbolKey": "@kubohiroya/turbowarp-named-data/registry/2.0",
  		"featureFlag": "NAMED_DATA_REGISTRY_MVP",
  		"defaultEnabled": false
  	}],
  	blocks: [{
  		"opcode": "isRegistryAvailable",
  		"blockType": "BOOLEAN",
  		"text": "named data registry available?",
  		"description": "Reports whether the startup-fixed Named Data registry feature is enabled.",
  		"arguments": {}
  	}]
  };
  //#endregion
  //#region src/feature-flags.ts
  function configuredFlag(name) {
  	const value = globalThis.__TW_NAMED_DATA_FEATURE_FLAGS__?.[name];
  	return value === true || value === "true";
  }
  /** Startup-fixed rollout flags. Configure these before loading the bundle. */
  var FEATURE_FLAGS = Object.freeze({ NAMED_DATA_REGISTRY_MVP: configuredFlag("NAMED_DATA_REGISTRY_MVP") });
  //#endregion
  //#region src/contract.ts
  var NAMED_DATA_REGISTRY_SYMBOL_KEY = "@kubohiroya/turbowarp-named-data/registry/2.0";
  var NAMED_DATA_REGISTRY_SYMBOL = Symbol.for(NAMED_DATA_REGISTRY_SYMBOL_KEY);
  var NAMED_DATA_KINDS = [
  	"structured",
  	"document",
  	"binary",
  	"asset"
  ];
  var NAMED_DATA_SCOPES = ["target", "project"];
  var NAMED_DATA_REPRESENTATIONS = [
  	"json",
  	"yaml",
  	"html",
  	"markdown",
  	"raw"
  ];
  var NAMED_DATA_ERROR_CODES = [
  	"NAMED_DATA_INVALID_REF",
  	"NAMED_DATA_INCOMPATIBLE_VERSION",
  	"NAMED_DATA_NAMESPACE_CONFLICT",
  	"NAMED_DATA_PROVIDER_NOT_FOUND",
  	"NAMED_DATA_NOT_FOUND",
  	"NAMED_DATA_KIND_MISMATCH",
  	"NAMED_DATA_SCOPE_MISMATCH",
  	"NAMED_DATA_REPRESENTATION_UNSUPPORTED",
  	"NAMED_DATA_INVALID_METADATA",
  	"NAMED_DATA_BODY_TOO_LARGE",
  	"NAMED_DATA_ABORTED",
  	"NAMED_DATA_PROVIDER_RELEASED"
  ];
  var NamedDataError = class extends Error {
  	constructor(code, message, options) {
  		super(`${code}: ${message}`, options);
  		this.code = code;
  		this.name = "NamedDataError";
  	}
  };
  //#endregion
  //#region src/registry.ts
  var LIFECYCLE_SYMBOL = Symbol.for("@kubohiroya/turbowarp-named-data/lifecycle/2.0");
  var NAMESPACE_PATTERN = /^[a-z][a-z0-9.-]{0,63}$/u;
  var errorCodes = new Set(NAMED_DATA_ERROR_CODES);
  var NamedDataRegistry = class {
  	constructor() {
  		this.contractVersion = "2.0";
  		this.symbolKey = NAMED_DATA_REGISTRY_SYMBOL_KEY;
  		this.providers = /* @__PURE__ */ new Map();
  		this.handles = /* @__PURE__ */ new Set();
  	}
  	registerProvider(provider, options = {}) {
  		requireNamespace(provider.namespace);
  		if (this.providers.has(provider.namespace)) throw new NamedDataError("NAMED_DATA_NAMESPACE_CONFLICT", `Namespace is already registered: ${provider.namespace}`);
  		if (!NAMED_DATA_KINDS.includes(provider.kind)) throw new NamedDataError("NAMED_DATA_INVALID_REF", `Unknown provider kind: ${provider.kind}`);
  		const entry = {
  			provider,
  			lifetime: options.lifetime ?? "session"
  		};
  		this.providers.set(provider.namespace, entry);
  		let active = true;
  		return {
  			namespace: provider.namespace,
  			unregister: async () => {
  				if (!active) return;
  				active = false;
  				if (this.providers.get(provider.namespace) === entry) {
  					this.providers.delete(provider.namespace);
  					await this.releaseHandlesForNamespace(provider.namespace);
  					await provider.release("shutdown");
  				}
  			}
  		};
  	}
  	canResolve(reference, representation) {
  		try {
  			validateReferenceShape(reference, representation);
  			const provider = this.providers.get(reference.namespace)?.provider;
  			return provider?.kind === reference.kind && provider.canResolve(reference, representation);
  		} catch {
  			return false;
  		}
  	}
  	async stat(reference, representation, context = {}) {
  		const provider = this.resolveProvider(reference, representation, context);
  		throwIfAborted(context.signal);
  		try {
  			const metadata = await provider.stat(reference, representation, context);
  			throwIfAborted(context.signal);
  			validateMetadata(metadata, reference, representation);
  			return metadata;
  		} catch (error) {
  			throw normalizeProviderError(error);
  		}
  	}
  	async openBody(reference, representation, context = {}) {
  		const provider = this.resolveProvider(reference, representation, context);
  		throwIfAborted(context.signal);
  		let opened;
  		try {
  			opened = await provider.openBody(reference, representation, context);
  			validateMetadata(opened, reference, representation);
  			if (!(opened.body instanceof Uint8Array) && !(opened.body instanceof ReadableStream)) throw new NamedDataError("NAMED_DATA_INVALID_METADATA", "Provider returned an invalid body.");
  		} catch (error) {
  			throw normalizeProviderError(error);
  		}
  		if (context.signal?.aborted) {
  			await opened.release("abort");
  			throw abortedError();
  		}
  		let released = false;
  		let abortListener;
  		const tracked = {
  			namespace: reference.namespace,
  			release: async (reason = "complete") => {
  				if (released) return;
  				released = true;
  				if (abortListener && context.signal) context.signal.removeEventListener("abort", abortListener);
  				this.handles.delete(tracked);
  				await opened.release(reason);
  			}
  		};
  		this.handles.add(tracked);
  		if (context.signal) {
  			abortListener = () => {
  				Promise.resolve(tracked.release("abort")).catch(() => void 0);
  			};
  			context.signal.addEventListener("abort", abortListener, { once: true });
  			if (context.signal.aborted) {
  				await tracked.release("abort");
  				throw abortedError();
  			}
  		}
  		return Object.freeze({
  			reference: Object.freeze({ ...opened.reference }),
  			nativeRepresentation: opened.nativeRepresentation,
  			representation: opened.representation,
  			mediaType: opened.mediaType,
  			...opened.byteLength === void 0 ? {} : { byteLength: opened.byteLength },
  			...opened.digest === void 0 ? {} : { digest: opened.digest },
  			revision: opened.revision,
  			replayable: opened.replayable,
  			body: opened.body,
  			release: tracked.release
  		});
  	}
  	async clearSession() {
  		const handles = [...this.handles];
  		this.handles.clear();
  		await Promise.allSettled(handles.map((handle) => handle.release("shutdown")));
  		const sessionEntries = [...this.providers.entries()].filter(([, entry]) => entry.lifetime === "session");
  		for (const [namespace] of sessionEntries) this.providers.delete(namespace);
  		await Promise.allSettled(sessionEntries.map(([, entry]) => entry.provider.release("shutdown")));
  		await Promise.allSettled([...this.providers.values()].map((entry) => entry.provider.clearSession?.()));
  	}
  	resolveProvider(reference, representation, context) {
  		validateReference(reference, representation, context);
  		const provider = this.providers.get(reference.namespace)?.provider;
  		if (!provider) throw new NamedDataError("NAMED_DATA_PROVIDER_NOT_FOUND", `No provider can resolve namespace: ${reference.namespace}`);
  		if (provider.kind !== reference.kind) throw new NamedDataError("NAMED_DATA_KIND_MISMATCH", `Provider kind ${provider.kind} does not match ${reference.kind}.`);
  		if (!provider.canResolve(reference, representation)) throw new NamedDataError("NAMED_DATA_REPRESENTATION_UNSUPPORTED", `Provider ${reference.namespace} does not support representation: ${representation}`);
  		return provider;
  	}
  	async releaseHandlesForNamespace(namespace) {
  		const handles = [...this.handles].filter((handle) => handle.namespace === namespace);
  		await Promise.allSettled(handles.map((handle) => handle.release("shutdown")));
  	}
  };
  function installNamedDataRegistry(runtime) {
  	const host = runtime;
  	const existing = host[NAMED_DATA_REGISTRY_SYMBOL];
  	if (existing !== void 0) return requireCompatibleRegistry(existing);
  	const registry = new NamedDataRegistry();
  	Object.defineProperty(host, NAMED_DATA_REGISTRY_SYMBOL, {
  		configurable: true,
  		enumerable: false,
  		writable: false,
  		value: registry
  	});
  	return registry;
  }
  function bindNamedDataRegistryLifecycle(runtime, registry) {
  	const host = runtime;
  	const existing = host[LIFECYCLE_SYMBOL];
  	if (existing !== void 0) {
  		if (existing.registry !== registry) throw new NamedDataError("NAMED_DATA_INCOMPATIBLE_VERSION", "Runtime already has a lifecycle binding for a different registry.");
  		existing.references += 1;
  		return lifecycleUnbind(runtime, host, existing);
  	}
  	const listener = () => {
  		registry.clearSession();
  	};
  	runtime.on("PROJECT_STOP_ALL", listener);
  	const binding = {
  		registry,
  		listener,
  		references: 1
  	};
  	Object.defineProperty(host, LIFECYCLE_SYMBOL, {
  		configurable: true,
  		enumerable: false,
  		writable: false,
  		value: binding
  	});
  	return lifecycleUnbind(runtime, host, binding);
  }
  function lifecycleUnbind(runtime, host, binding) {
  	let active = true;
  	return () => {
  		if (!active || host[LIFECYCLE_SYMBOL] !== binding) return;
  		active = false;
  		binding.references -= 1;
  		if (binding.references > 0) return;
  		runtime.off?.("PROJECT_STOP_ALL", binding.listener);
  		delete host[LIFECYCLE_SYMBOL];
  	};
  }
  function requireCompatibleRegistry(value) {
  	if (typeof value !== "object" || value === null || value.contractVersion !== "2.0" || value.symbolKey !== "@kubohiroya/turbowarp-named-data/registry/2.0") throw new NamedDataError("NAMED_DATA_INCOMPATIBLE_VERSION", `Runtime slot ${NAMED_DATA_REGISTRY_SYMBOL_KEY} contains an incompatible service.`);
  	return value;
  }
  function validateReference(reference, representation, context) {
  	validateReferenceShape(reference, representation);
  	if (reference.scope === "target" && context.target === void 0) throw new NamedDataError("NAMED_DATA_SCOPE_MISMATCH", "Target scope requires target context.");
  	if (reference.scope === "project" && context.project === void 0) throw new NamedDataError("NAMED_DATA_SCOPE_MISMATCH", "Project scope requires project context.");
  	throwIfAborted(context.signal);
  }
  function validateReferenceShape(reference, representation) {
  	if (!reference || typeof reference !== "object") throw invalidReference();
  	requireNamespace(reference.namespace);
  	if (typeof reference.name !== "string" || reference.name.length === 0 || reference.name.length > 256 || containsControlCharacter(reference.name) || !NAMED_DATA_KINDS.includes(reference.kind) || !NAMED_DATA_SCOPES.includes(reference.scope) || !NAMED_DATA_REPRESENTATIONS.includes(representation)) throw invalidReference();
  }
  function validateMetadata(metadata, reference, representation) {
  	if (metadata.representation !== representation || !isNativeRepresentation(metadata.reference.kind, metadata.nativeRepresentation) || metadata.reference.namespace !== reference.namespace || metadata.reference.name !== reference.name || metadata.reference.kind !== reference.kind || metadata.reference.scope !== reference.scope || typeof metadata.mediaType !== "string" || metadata.mediaType.length === 0 || typeof metadata.revision !== "string" || metadata.revision.length === 0 || typeof metadata.replayable !== "boolean" || metadata.byteLength !== void 0 && (!Number.isSafeInteger(metadata.byteLength) || metadata.byteLength < 0) || metadata.digest !== void 0 && !/^sha256-[A-Za-z0-9_-]+$/u.test(metadata.digest)) throw new NamedDataError("NAMED_DATA_INVALID_METADATA", "Provider returned invalid metadata.");
  }
  function isNativeRepresentation(kind, representation) {
  	if (kind === "structured") return representation === "json" || representation === "yaml";
  	if (kind === "document") return representation === "html" || representation === "markdown";
  	return representation === "raw";
  }
  function requireNamespace(namespace) {
  	if (typeof namespace !== "string" || !NAMESPACE_PATTERN.test(namespace)) throw invalidReference("Invalid namespace.");
  }
  function containsControlCharacter(value) {
  	return [...value].some((character) => {
  		const code = character.codePointAt(0) ?? 0;
  		return code <= 31 || code === 127;
  	});
  }
  function invalidReference(message = "Invalid named-data reference.") {
  	return new NamedDataError("NAMED_DATA_INVALID_REF", message);
  }
  function throwIfAborted(signal) {
  	if (signal?.aborted) throw abortedError();
  }
  function abortedError() {
  	return new NamedDataError("NAMED_DATA_ABORTED", "Named-data operation was aborted.");
  }
  function normalizeProviderError(error) {
  	if (error instanceof NamedDataError) return error;
  	if (error instanceof Error && "code" in error && typeof error.code === "string" && errorCodes.has(error.code)) return new NamedDataError(error.code, error.message, { cause: error });
  	return new NamedDataError("NAMED_DATA_PROVIDER_RELEASED", "Provider operation failed.", { cause: error });
  }
  //#endregion
  //#region src/extension.ts
  var NamedDataExtension = class {
  	constructor(runtime, featureFlags = FEATURE_FLAGS) {
  		if (featureFlags.NAMED_DATA_REGISTRY_MVP) {
  			this.registry = installNamedDataRegistry(runtime);
  			this.unbindLifecycle = bindNamedDataRegistryLifecycle(runtime, this.registry);
  		}
  	}
  	getInfo() {
  		return {
  			id: extensionConfig.id,
  			name: Scratch.translate(block_definitions_default.extensionName),
  			docsURI: extensionConfig.docsURI,
  			blockIconURI: extensionConfig.blockIconURI,
  			blocks: this.registry ? [{
  				opcode: "isRegistryAvailable",
  				blockType: Scratch.BlockType.BOOLEAN,
  				text: Scratch.translate("named data registry available?")
  			}] : []
  		};
  	}
  	isRegistryAvailable() {
  		return this.registry !== void 0;
  	}
  	/** Used by hosts that unload extensions without stopping the project. */
  	dispose() {
  		this.unbindLifecycle?.();
  	}
  };
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  Scratch.extensions.register(new NamedDataExtension(Scratch.vm.runtime));
  //#endregion

})(Scratch);
