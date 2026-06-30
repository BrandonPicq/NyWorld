import type { Component, EntityId } from "./types";

export class World {
  private nextId = 1;
  private entities = new Map<EntityId, Map<string, Component>>();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.set(id, new Map());
    return id;
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  addComponent(id: EntityId, component: Component): void {
    const components = this.entities.get(id);
    if (!components) {
      return;
    }
    components.set(component.type, component);
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.entities.get(id)?.get(type) as T | undefined;
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.entities.get(id)?.has(type) ?? false;
  }

  removeComponent(id: EntityId, type: string): boolean {
    return this.entities.get(id)?.delete(type) ?? false;
  }

  entitiesWith(...types: string[]): EntityId[] {
    const result: EntityId[] = [];

    for (const [id, components] of this.entities) {
      if (types.every((type) => components.has(type))) {
        result.push(id);
      }
    }

    return result;
  }
}
