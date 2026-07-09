import type { ComponentType } from "react";
import { registerRouteSurface } from "@/shared/lib/hub/routeSurfaceRegistry";

function asComponent(component: ComponentType | undefined): ComponentType {
  if (!component) {
    throw new Error("Route surface component is undefined");
  }
  return component;
}

registerRouteSurface("/sandbox/preview", () =>
  import("../sandbox/preview/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/apis/client", () =>
  import("../apis/client/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/apis/json-schema", () =>
  import("../apis/json-schema/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/server-logs", () =>
  import("../server-logs/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/apis/logs", () =>
  import("../apis/logs/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/apis/mocking", () =>
  import("../apis/mocking/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/apis/schema", () =>
  import("../apis/schema/index").then((m) => ({
    default: asComponent(m.ApiSchemaPage),
  })),
);

registerRouteSurface("/profile", () =>
  import("../profile/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);

registerRouteSurface("/proxy/connections", () =>
  import("../proxy/connections/index").then((m) => ({
    default: asComponent(m.Route.options.component),
  })),
);
