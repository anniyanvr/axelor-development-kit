/*
 * Axelor Business Solutions
 *
 * Copyright (C) 2005-2025 Axelor (<http://axelor.com>).
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
package com.axelor.inject.logger;

import com.google.inject.Binding;
import javax.inject.Provider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class LoggerProvider implements Provider<Logger> {

  @Override
  public Logger get() {
    final Binding<?> binding = LoggerProvisionListener.bindingStack.get().peek();
    return binding == null
        ? LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)
        : LoggerFactory.getLogger(binding.getKey().getTypeLiteral().getRawType().getName());
  }
}
