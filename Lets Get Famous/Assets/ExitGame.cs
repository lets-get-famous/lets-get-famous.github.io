using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ExitGame : MonoBehaviour
{
void Update()
{
    if (Input.GetKeyDown(KeyCode.Escape))
    {
        Application.Quit();
    }
    if (Input.GetKeyDown(KeyCode.Return))
    {
         RestartCurrentScene();
    }
}

private void RestartCurrentScene()
{
    UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().name);
}
}
