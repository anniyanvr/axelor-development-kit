/*
 * Axelor Business Solutions
 *
 * Copyright (C) 2005-2022 Axelor (<http://axelor.com>).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package com.axelor.meta.loader;

import com.axelor.common.StringUtils;
import com.axelor.db.JPA;
import com.google.common.collect.HashMultimap;
import com.google.common.collect.Multimap;
import com.google.common.collect.Sets;
import java.util.AbstractMap.SimpleImmutableEntry;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.function.BiConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

abstract class AbstractLoader {

  private static final Logger LOG = LoggerFactory.getLogger(AbstractLoader.class);

  private static final Set<Entry<Class<?>, String>> visited = new HashSet<>();
  private static final Map<Class<?>, Multimap<String, Long>> unresolved = new HashMap<>();
  private static final List<Runnable> resolveTasks = new ArrayList<>();

  /**
   * Checks whether an element is already visited. Element can be either identified the pair {@code
   * type}/{@code name} or by its {@code xmlId}.
   *
   * @param type element type
   * @param name element name
   * @param baseType element base type
   * @param xmlId element xmlId
   * @return whether the element is already visited
   */
  protected boolean isVisited(Class<?> type, String name, Class<?> baseType, String xmlId) {
    final Class<?> entryType;
    final String entryName;
    final boolean withoutId = StringUtils.isBlank(xmlId);

    if (withoutId) {
      entryType = type;
      entryName = name;
    } else {
      entryType = baseType;
      entryName = xmlId;
    }

    synchronized (visited) {
      final Entry<Class<?>, String> key = new SimpleImmutableEntry<>(entryType, entryName);
      if (visited.contains(key)) {
        LOG.error(
            "Duplicate {} found {} 'id': {}",
            type.getSimpleName(),
            withoutId ? "without" : "with",
            entryName);
        return true;
      }
      visited.add(key);
      return false;
    }
  }

  /**
   * Checks whether an element is already visited. Element can be either identified the pair {@code
   * type}/{@code name} or by its {@code xmlId}.
   *
   * @param type element type
   * @param name element name
   * @param xmlId element xmlId
   * @return whether the element is already visited
   */
  protected boolean isVisited(Class<?> type, String name, String xmlId) {
    return isVisited(type, name, type, xmlId);
  }

  /**
   * Put a value of the given type for resolution for the given unresolved key.<br>
   * <br>
   * The value is put inside a {@link Multimap} with unresolvedKey as the key.
   *
   * @param type
   * @param unresolvedKey
   * @param entityId
   */
  protected <T> void setUnresolved(Class<T> type, String unresolvedKey, Long entityId) {
    synchronized (unresolved) {
      final Multimap<String, Long> mm =
          unresolved.computeIfAbsent(type, key -> HashMultimap.create());
      mm.put(unresolvedKey, entityId);
    }
  }

  /**
   * Resolve the given unresolved key.<br>
   * <br>
   * All the pending values of the unresolved key are returned for further processing. The values
   * are removed from the backing {@link Multimap}.
   *
   * @param type the type of pending objects
   * @param unresolvedKey the unresolved key
   * @return a set of all the pending objects
   */
  protected <T> Set<Long> resolve(Class<T> type, String unresolvedKey) {
    synchronized (unresolved) {
      Set<Long> entityIds = Sets.newHashSet();
      Multimap<String, Long> mm = unresolved.get(type);
      if (mm == null) {
        return entityIds;
      }
      for (Long item : mm.get(unresolvedKey)) {
        entityIds.add((Long) item);
      }
      mm.removeAll(unresolvedKey);
      return entityIds;
    }
  }

  protected void addResolveTask(
      Class<?> type, String name, Long entityId, BiConsumer<Long, Long> consumer) {
    Runnable task = () -> resolve(type, name).forEach(id -> consumer.accept(id, entityId));
    synchronized (resolveTasks) {
      resolveTasks.add(task);
    }
  }

  protected void runResolveTasks() {
    if (resolveTasks.isEmpty()) {
      return;
    }

    synchronized (resolveTasks) {
      resolveTasks.forEach(task -> JPA.runInTransaction(task::run));
      resolveTasks.clear();
    }
  }

  /**
   * Return set of all the unresolved keys.
   *
   * @return set of unresolved keys
   */
  protected Set<String> unresolvedKeys() {
    synchronized (unresolved) {
      Set<String> names = Sets.newHashSet();
      for (Multimap<String, Long> mm : unresolved.values()) {
        names.addAll(mm.keySet());
      }
      return names;
    }
  }

  /**
   * Implement this method the load the data.
   *
   * @param module the module for which to load the data
   * @param update whether to force update while loading
   */
  protected abstract void doLoad(Module module, boolean update);

  /**
   * This method is called by the module installer as last step when loading of all modules is
   * complete.
   *
   * @param module the module the process
   * @param update whether to update
   */
  void doLast(Module module, boolean update) {}

  static void doCleanUp() {
    synchronized (visited) {
      visited.clear();
    }
    synchronized (unresolved) {
      unresolved.clear();
    }
    synchronized (resolveTasks) {
      resolveTasks.clear();
    }
  }

  public final void load(Module module, boolean update) {
    doLoad(module, update);
  }
}
