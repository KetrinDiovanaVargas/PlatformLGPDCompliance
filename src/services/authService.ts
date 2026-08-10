/**
 * @module services/authService
 * @description Serviço de autenticação centralizado para gerenciamento de usuários
 * via Firebase Authentication. Fornece operações de registro, login, logout e
 * observação de estado de autenticação com suporte a callbacks reativos.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

/**
 * Registra um novo usuário na plataforma utilizando email e senha.
 *
 * Esta função cria uma nova conta de usuário no Firebase Authentication.
 * A senha é processada pelo Firebase (hash seguro) e o usuário é retornado
 * após criação bem-sucedida.
 *
 * @async
 * @function registerUser
 * @param {string} email - Endereço de email único do usuário (validado pelo Firebase)
 * @param {string} password - Senha da conta (mínimo 6 caracteres conforme Firebase)
 * @returns {Promise<User>} Objeto User contendo informações da conta criada (uid, email, etc.)
 * @throws {Error} Lança erro se:
 *   - Email já está registrado na plataforma
 *   - Email possui formato inválido
 *   - Senha não atende critérios mínimos (< 6 caracteres)
 *   - Há falha de conexão com Firebase
 *
 * @example
 * try {
 *   const newUser = await registerUser("usuario@example.com", "senhaSegura123");
 *   console.log("Usuário criado:", newUser.uid);
 * } catch (error) {
 *   console.error("Erro no registro:", error.message);
 * }
 */
export async function registerUser(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Autentica um usuário existente utilizando suas credenciais de email e senha.
 *
 * Esta função valida as credenciais fornecidas contra os registros do Firebase
 * e estabelece uma sessão de autenticação ativa para o usuário. O estado de
 * autenticação persiste além da sessão atual (conforme configuração do app).
 *
 * @async
 * @function loginUser
 * @param {string} email - Email registrado da conta de usuário
 * @param {string} password - Senha da conta
 * @returns {Promise<User>} Objeto User autenticado contendo informações da sessão (uid, email, etc.)
 * @throws {Error} Lança erro se:
 *   - Credenciais (email/senha) são inválidas
 *   - Usuário não existe no banco de dados
 *   - Conta foi desabilitada (suspensão administrativa)
 *   - Há falha de conexão com Firebase
 *
 * @example
 * try {
 *   const user = await loginUser("usuario@example.com", "senhaSegura123");
 *   console.log("Login bem-sucedido:", user.email);
 * } catch (error) {
 *   console.error("Falha na autenticação:", error.message);
 * }
 */
export async function loginUser(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Encerra a sessão de autenticação do usuário atual.
 *
 * Esta função invalida o token de autenticação do usuário e limpa o estado
 * de sessão local. Após logout, o usuário é redirecionado implicitamente para
 * estado não autenticado, dispara listeners de observação de estado com `null`.
 *
 * @async
 * @function logoutUser
 * @returns {Promise<void>} Promessa que resolve quando logout é concluído
 * @throws {Error} Lança erro se há falha de conexão com Firebase durante logout
 *
 * @example
 * try {
 *   await logoutUser();
 *   console.log("Logout realizado com sucesso");
 *   // Observadores de autenticação são notificados automaticamente
 * } catch (error) {
 *   console.error("Erro ao fazer logout:", error.message);
 * }
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Observa mudanças no estado de autenticação do usuário.
 *
 * Registra um listener que é disparado imediatamente com o estado atual de
 * autenticação e novamente sempre que esse estado mudar (login, logout, refresh
 * de token, etc.). Útil para sincronizar UI com estado de autenticação.
 *
 * Esta é uma função reactiva: o callback será chamado automaticamente pelo
 * Firebase sempre que o estado de autenticação mudar, sem necessidade de
 * polling ou requisições periódicas.
 *
 * @function observeUser
 * @param {Function} callback - Função chamada quando estado de autenticação muda
 *   @param {User|null} callback.user - Objeto User se autenticado, null caso contrário
 *     - Se `user` é null: nenhum usuário está autenticado
 *     - Se `user` é User: contém uid, email, displayName, etc.
 * @returns {Function} Função para unsubscribe do listener. Chamar para parar de
 *   observar mudanças e liberar recursos.
 *
 * @example
 * // Monitorar estado de autenticação
 * const unsubscribe = observeUser((user) => {
 *   if (user) {
 *     console.log("Usuário autenticado:", user.email);
 *     // Atualizar UI para estado autenticado
 *   } else {
 *     console.log("Usuário desconectado");
 *     // Atualizar UI para estado não autenticado
 *   }
 * });
 *
 * // Mais tarde, parar observação
 * unsubscribe();
 *
 * @example
 * // Uso em React (efeito)
 * useEffect(() => {
 *   const unsubscribe = observeUser((user) => {
 *     setCurrentUser(user);
 *   });
 *   return unsubscribe; // Cleanup automático ao desmontar
 * }, []);
 */
export function observeUser(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}