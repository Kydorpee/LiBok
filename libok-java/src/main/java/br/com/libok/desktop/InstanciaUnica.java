package br.com.libok.desktop;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;

/** Detecta se já existe um LiBok respondendo na porta local. */
public final class InstanciaUnica {

    private InstanciaUnica() {
    }

    public static boolean emExecucao(int porta) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", porta), 300);
            return true;
        } catch (IOException naoHaServidor) {
            return false;
        }
    }
}
